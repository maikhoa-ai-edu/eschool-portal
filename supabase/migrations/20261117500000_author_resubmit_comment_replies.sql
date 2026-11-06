-- Schema 0.14.0 (tiếp): tác giả sửa bài đã đăng của mình (bài về Chờ duyệt, trừ bài dự thi),
-- bình luận có trả lời một cấp và lượt thích bình luận.

-- ---------------------------------------------------------------------------
-- Bài dự thi: tin có thẻ thuộc một cuộc thi
-- ---------------------------------------------------------------------------

create function private.is_contest_entry(p_news uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contests c
    join public.news_tag_map m on m.tag_id = c.tag_id
    where m.news_id = p_news
  )
$$;

-- Trang soạn bài cần biết để ẩn nút sửa của tác giả (CSDL vẫn chặn ở RLS và trigger)
create function public.news_is_contest_entry(p_news uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_contest_entry(p_news)
$$;

grant execute on function public.news_is_contest_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tác giả sửa bài đã đăng: bài chuyển về Chờ duyệt, tạm ẩn tới khi được duyệt lại
-- ---------------------------------------------------------------------------

create or replace function private.news_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_publish boolean := private.is_trusted_connection() or public.has_permission('news.publish');
  v_author_resubmit boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_author_resubmit := old.status = 'published' and new.status = 'pending'
      and old.author_id = auth.uid() and public.has_permission('news.edit_own')
      and not private.is_contest_entry(old.id);
    if new.author_id is distinct from old.author_id and not private.is_trusted_connection()
       and not public.has_permission('news.edit_any') then
      raise exception 'Không được đổi tác giả bài viết' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and (new.status in ('published', 'archived') or old.status in ('published', 'archived'))
       and not v_can_publish and not v_author_resubmit then
      raise exception 'Không có quyền xuất bản hoặc gỡ bài viết' using errcode = '42501';
    end if;
    if not v_can_publish
       and (new.is_featured is distinct from old.is_featured
            or new.show_on_slider is distinct from old.show_on_slider
            or new.published_at is distinct from old.published_at
            or new.published_by is distinct from old.published_by) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật, slide hoặc ngày đăng' using errcode = '42501';
    end if;
  else
    if new.status in ('published', 'archived') and not v_can_publish then
      raise exception 'Không có quyền xuất bản bài viết' using errcode = '42501';
    end if;
    if not v_can_publish
       and (new.is_featured or new.show_on_slider or new.published_at is not null or new.published_by is not null) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật, slide hoặc ngày đăng' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(auth.uid(), new.published_by);
  end if;

  return new;
end;
$$;

drop policy "Sửa tin" on public.news;
create policy "Sửa tin" on public.news
  for update to authenticated
  using (
    public.has_permission('news.edit_any')
    or (author_id = (select auth.uid()) and public.has_permission('news.edit_own')
        and (status in ('draft', 'pending') or (status = 'published' and not private.is_contest_entry(id))))
  )
  -- Tác giả lưu bài đã đăng thì bài phải về Chờ duyệt (trigger news_workflow cho phép đúng bước này)
  with check (
    public.has_permission('news.edit_any')
    or (author_id = (select auth.uid()) and status in ('draft', 'pending'))
  );

-- ---------------------------------------------------------------------------
-- Bình luận: trả lời một cấp
-- ---------------------------------------------------------------------------

alter table public.news_comments
  add column parent_id uuid references public.news_comments (id) on delete cascade;

create index news_comments_parent_idx on public.news_comments (parent_id) where parent_id is not null;

create or replace function private.guard_news_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_parent public.news_comments;
begin
  if private.is_trusted_connection() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := v_uid;
    new.status := 'pending';
    new.moderated_by := null;
    new.moderated_at := null;
    select p.full_name into new.author_name from public.profiles p where p.id = v_uid;
    if new.parent_id is not null then
      select * into v_parent from public.news_comments c where c.id = new.parent_id;
      if v_parent.id is null or v_parent.news_id <> new.news_id or v_parent.parent_id is not null
         or v_parent.status <> 'approved' then
        raise exception 'Chỉ trả lời được bình luận đã duyệt của cùng bài viết' using errcode = '22023';
      end if;
    end if;
    if (select count(*) from public.news_comments c
        where c.user_id = v_uid and c.created_at > now() - interval '10 minutes') >= 5 then
      raise exception 'Bạn gửi bình luận quá nhanh. Vui lòng thử lại sau ít phút.' using errcode = '54000';
    end if;
    return new;
  end if;
  -- Người duyệt chỉ đổi trạng thái, không sửa lời của người khác
  if new.news_id is distinct from old.news_id or new.user_id is distinct from old.user_id
     or new.author_name is distinct from old.author_name or new.content is distinct from old.content
     or new.parent_id is distinct from old.parent_id then
    raise exception 'Chỉ được đổi trạng thái bình luận' using errcode = '42501';
  end if;
  new.moderated_by := v_uid;
  new.moderated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Thích bình luận: tài khoản đang hoạt động, mỗi người một lượt
-- ---------------------------------------------------------------------------

create table public.news_comment_likes (
  comment_id uuid not null references public.news_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index news_comment_likes_user_idx on public.news_comment_likes (user_id);

create function private.guard_news_comment_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_connection() then
    return new;
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger news_comment_likes_guard before insert on public.news_comment_likes
  for each row execute function private.guard_news_comment_like();

alter table public.news_comment_likes enable row level security;
create policy "Xem lượt thích của mình" on public.news_comment_likes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Thích bình luận" on public.news_comment_likes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
    and exists (select 1 from public.news_comments c where c.id = comment_id and c.status = 'approved')
  );
create policy "Bỏ thích bình luận" on public.news_comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.news_comment_likes to authenticated;

-- Số lượt thích các bình luận đã duyệt của một bài (không lộ ai đã bấm)
create function public.news_comment_like_counts(p_news uuid)
returns table (comment_id uuid, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.comment_id, count(*)
  from public.news_comment_likes l
  join public.news_comments c on c.id = l.comment_id
  where c.news_id = p_news and c.status = 'approved'
  group by l.comment_id
$$;

grant execute on function public.news_comment_like_counts(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sao lưu: thêm lượt thích bình luận
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
    'contests', 'news_reactions', 'news_comment_likes'
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
  delete from public.news_comment_likes where true;
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
