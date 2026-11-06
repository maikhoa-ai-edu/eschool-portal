-- Schema 0.14.0: cuộc thi viết, cảm xúc dưới bài viết, kiểu trình bày "Thư tri ân".
-- Bài dự thi là tin tức bình thường có gắn thẻ của cuộc thi; học sinh không cần tài khoản.

alter table public.news
  add column author_class text check (author_class is null or length(author_class) <= 50),
  add column display_style text not null default 'default' check (display_style in ('default', 'letter'));

-- Module mới bật sẵn cho bản cài mới, tắt cho trường đang chạy để giao diện không tự đổi
insert into public.module_settings (module_key, is_enabled)
values ('reactions', not exists (select 1 from public.profiles where role = 'SUPER_ADMIN'));

-- ---------------------------------------------------------------------------
-- Cuộc thi: mỗi cuộc thi gắn một thẻ tin tức, có hạn bình chọn
-- ---------------------------------------------------------------------------

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  tag_id uuid not null unique references public.news_tags (id) on delete restrict,
  vote_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contests_updated_at before update on public.contests
  for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on public.contests
  for each row execute function private.audit_row();

alter table public.contests enable row level security;
create policy "Xem cuộc thi" on public.contests
  for select to anon, authenticated using (true);
create policy "Quản lý cuộc thi" on public.contests
  for all to authenticated
  using (public.has_permission('topics.manage'))
  with check (public.has_permission('topics.manage'));

grant select on public.contests to anon;
grant select, insert, update, delete on public.contests to authenticated;

-- Bài thuộc một cuộc thi đã hết hạn bình chọn
create function private.news_votes_closed(p_news uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contests c
    join public.news_tag_map m on m.tag_id = c.tag_id
    where m.news_id = p_news and c.vote_ends_at is not null and c.vote_ends_at <= now()
  )
$$;

-- ---------------------------------------------------------------------------
-- Cảm xúc: chỉ tài khoản đang hoạt động, mỗi tài khoản một cảm xúc cho một bài
-- ---------------------------------------------------------------------------

create table public.news_reactions (
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'clap', 'grateful')),
  created_at timestamptz not null default now(),
  primary key (news_id, user_id)
);

create index news_reactions_user_idx on public.news_reactions (user_id);

create function private.guard_news_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_news uuid := case when tg_op = 'DELETE' then old.news_id else new.news_id end;
begin
  if private.is_trusted_connection() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and (new.news_id is distinct from old.news_id or new.user_id is distinct from old.user_id) then
    raise exception 'Chỉ được đổi loại cảm xúc' using errcode = '42501';
  end if;
  -- Sau hạn bình chọn số liệu đứng yên: không thêm, đổi, hay bỏ cảm xúc
  if private.news_votes_closed(v_news) then
    raise exception 'Đã hết hạn bình chọn cho bài này.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger news_reactions_guard before insert or update or delete on public.news_reactions
  for each row execute function private.guard_news_reaction();

alter table public.news_reactions enable row level security;
create policy "Xem cảm xúc của mình" on public.news_reactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Bày tỏ cảm xúc" on public.news_reactions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
    and exists (select 1 from public.news n where n.id = news_id and n.status = 'published' and n.published_at <= now())
  );
create policy "Đổi cảm xúc" on public.news_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
  );
create policy "Bỏ cảm xúc" on public.news_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.news_reactions to authenticated;

-- Số cảm xúc theo loại của các bài đã đăng (không lộ ai đã bấm)
create function public.news_reaction_counts(p_news_ids uuid[])
returns table (news_id uuid, reaction text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.news_id, r.reaction, count(*)
  from public.news_reactions r
  join public.news n on n.id = r.news_id
  where r.news_id = any (p_news_ids[1:200]) and n.status = 'published' and n.published_at <= now()
  group by r.news_id, r.reaction
$$;

-- Bài dự thi đã đăng của một cuộc thi kèm số cảm xúc và số bình luận đã duyệt
-- (dùng cho trang lưới và bảng xếp hạng; số liệu này vốn công khai dưới từng bài)
create function public.contest_entries(p_contest uuid)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  thumbnail_url text,
  author_name text,
  author_class text,
  published_at timestamptz,
  reactions jsonb,
  total_reactions bigint,
  comment_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Không có tóm tắt thì trích đầu bài (bỏ thẻ HTML)
  select n.id, n.title, n.slug,
    coalesce(nullif(trim(n.excerpt), ''),
      left(trim(regexp_replace(replace(n.content, '&nbsp;', ' '), '<[^>]+>|\s+', ' ', 'g')), 220)),
    n.thumbnail_url, n.author_name, n.author_class, n.published_at,
    coalesce((
      select jsonb_object_agg(x.reaction, x.total)
      from (
        select r.reaction, count(*) as total from public.news_reactions r
        where r.news_id = n.id group by r.reaction
      ) x
    ), '{}'::jsonb),
    (select count(*) from public.news_reactions r where r.news_id = n.id),
    (select count(*) from public.news_comments c where c.news_id = n.id and c.status = 'approved')
  from public.contests ct
  join public.news_tag_map m on m.tag_id = ct.tag_id
  join public.news n on n.id = m.news_id
  where ct.id = p_contest and n.status = 'published' and n.published_at <= now()
  order by n.published_at desc
$$;

grant execute on function public.news_reaction_counts(uuid[]) to anon, authenticated;
grant execute on function public.contest_entries(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sao lưu: thêm hai bảng mới (bản sao lưu cũ không có bảng này thì bỏ qua)
-- ---------------------------------------------------------------------------
create or replace function private.backup_content_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'news_categories', 'news_tags', 'news', 'news_tag_map', 'content_groups', 'announcements', 'documents', 'pages',
    'menus', 'menu_items', 'media', 'albums', 'album_items', 'homepage_slides', 'site_visits_daily', 'topics',
    'videos', 'resources', 'work_plans', 'work_plan_items', 'news_comments', 'org_units', 'org_members',
    'contests', 'news_reactions'
  ]
$$;

create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_current int[] := string_to_array(public.get_schema_version(), '.')::int[];
  v_text text;
  v_backup jsonb;
  v_data jsonb;
  v_profile jsonb;
  v_existing uuid;
  v_table text;
  v_tables text[] := private.backup_content_tables();
  v_audit_start bigint;
  v_counts jsonb := '{}'::jsonb;
begin
  if not public.has_permission('backup.manage') then
    raise exception 'Không có quyền khôi phục dữ liệu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_backup -> 'data') is distinct from 'object'
     or jsonb_typeof(p_backup -> 'data' -> 'profiles') is distinct from 'array' then
    raise exception 'File sao lưu không đúng định dạng' using errcode = '22023';
  end if;
  if string_to_array(p_backup ->> 'schema_version', '.')::int[] > v_current then
    raise exception 'Bản sao lưu được tạo từ phiên bản mới hơn (%). Hãy nâng cấp CSDL trước khi khôi phục.',
      p_backup ->> 'schema_version' using errcode = '22023';
  end if;

  -- Cùng email nhưng khác id (vd quản trị viên vừa tạo ở project mới): đổi mọi tham chiếu sang id đang có
  v_text := p_backup::text;
  for v_profile in select jsonb_array_elements(p_backup -> 'data' -> 'profiles') loop
    select id into v_existing from public.profiles where email = v_profile ->> 'email';
    if v_existing is not null and v_existing::text <> v_profile ->> 'id' then
      v_text := replace(v_text, v_profile ->> 'id', v_existing::text);
    end if;
  end loop;
  v_backup := v_text::jsonb;
  v_data := v_backup -> 'data';

  -- Từ đây chạy như kết nối tin cậy (đã kiểm tra quyền ở trên): dữ liệu chép nguyên trạng, không qua các guard.
  -- Cờ và claim chỉ sống trong giao dịch này.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('eschool.restoring', 'on', true);

  select coalesce(max(id), 0) into v_audit_start from public.audit_logs;

  delete from public.invitations where true;
  delete from public.news_comments where true;
  delete from public.news_reactions where true;
  delete from public.contests where true;
  delete from public.org_members where true;
  delete from public.org_units where true;
  delete from public.work_plan_items where true;
  delete from public.work_plans where true;
  delete from public.videos where true;
  delete from public.resources where true;
  delete from public.album_items where true;
  delete from public.albums where true;
  delete from public.media where true;
  delete from public.news_tag_map where true;
  delete from public.news where true;
  delete from public.news_tags where true;
  delete from public.news_categories where true;
  delete from public.announcements where true;
  delete from public.documents where true;
  delete from public.pages where true;
  delete from public.menu_items where true;
  delete from public.menus where true;
  delete from public.homepage_slides where true;
  delete from public.site_visits_daily where true;
  delete from public.topics where true;
  delete from public.content_groups where true;

  for v_profile in select jsonb_array_elements(v_data -> 'profiles') loop
    perform private.restore_account(v_profile);
  end loop;
  perform private.restore_rows('profiles', v_data -> 'profiles', 'id');

  foreach v_table in array v_tables loop
    perform private.restore_rows(v_table, v_data -> v_table);
    v_counts := v_counts || jsonb_build_object(v_table, jsonb_array_length(coalesce(v_data -> v_table, '[]'::jsonb)));
  end loop;
  perform private.restore_rows('site_settings', v_data -> 'site_settings', 'key');
  perform private.restore_rows('module_settings', v_data -> 'module_settings', 'module_key');
  perform private.ensure_mobile_menu();

  -- Lời mời còn mở của người nay đã có tài khoản thì bỏ; mã mới được sinh theo giá trị mặc định
  perform private.restore_rows('invitations', (
    select coalesce(jsonb_agg(i), '[]'::jsonb)
    from jsonb_array_elements(coalesce(v_data -> 'invitations', '[]'::jsonb)) i
    where i ->> 'accepted_at' is not null
       or not exists (select 1 from public.profiles p where p.email = i ->> 'email')
  ));

  -- Người khôi phục luôn giữ được quyền, kể cả khi bản sao lưu ghi khác
  update public.profiles set role = 'SUPER_ADMIN', is_active = true where id = v_caller;
  update private.install_state set completed_at = coalesce(completed_at, now()) where id;

  -- Nhật ký cũ không bị xóa (khôi phục không được dùng để xóa dấu vết). Bỏ các dòng do chính thao tác này
  -- sinh ra, gộp lịch sử trong bản sao lưu, rồi ghi một dòng cho việc khôi phục.
  delete from public.audit_logs where id > v_audit_start;
  insert into public.audit_logs (occurred_at, actor_id, actor_role, action, table_name, record_id, changed_fields, summary)
  select r.occurred_at, r.actor_id, r.actor_role, r.action, r.table_name, r.record_id, r.changed_fields, r.summary
  from jsonb_populate_recordset(null::public.audit_logs, coalesce(v_data -> 'audit_logs', '[]'::jsonb)) r
  where not exists (
    select 1 from public.audit_logs a
    where a.occurred_at = r.occurred_at and a.table_name = r.table_name and a.action = r.action
      and a.record_id is not distinct from r.record_id
  );
  insert into public.audit_logs (actor_id, actor_role, action, table_name, summary)
  values (v_caller, 'SUPER_ADMIN', 'UPDATE', 'backup',
    'Khôi phục bản sao lưu ngày ' || coalesce(left(p_backup ->> 'created_at', 10), '?'));

  return v_counts;
end;
$$;
