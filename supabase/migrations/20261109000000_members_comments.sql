-- Giai đoạn 8.6, schema 0.10.0 (đợt D): vai trò Thành viên (hồ sơ không có role), tự đăng ký, Google, bình luận có duyệt.
-- Thành viên không có quyền nào trong role_permissions nên không vào được quản trị; RLS không đổi với họ.

insert into public.site_settings (key, value) values
  ('auth_options', jsonb_build_object(
    'allow_self_signup', false,
    'google_enabled', false,
    'google_client_id', ''
  ))
on conflict (key) do nothing;

-- Thành viên có thể là học sinh: khách chỉ được đọc tên nhân sự, không đọc tên thành viên
drop policy "Khách xem tên nhân sự đang hoạt động" on public.profiles;
create policy "Khách xem tên nhân sự đang hoạt động" on public.profiles
  for select to anon using (is_active and role is not null);

-- Đăng ký: có lời mời đúng mã thì theo vai trò được mời; Google đã xác minh email nên lời mời không cần mã;
-- không có lời mời thì chỉ thành công khi trường bật tự đăng ký, và luôn thành Thành viên (role null).
-- Cờ đọc từ CSDL và raw_app_meta_data do máy chủ Auth ghi, người dùng không tự đặt được.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
  v_verified_google boolean := new.raw_app_meta_data ->> 'provider' = 'google' and new.email_confirmed_at is not null;
begin
  if current_setting('eschool.restoring', true) = 'on' then
    return new;
  end if;

  select * into v_invite
  from public.invitations
  where email = lower(new.email)
    and (token::text = new.raw_user_meta_data ->> 'invite_token' or v_verified_google)
    and accepted_at is null
    and expires_at > now()
  for update;

  if v_invite.id is null
     and exists (select 1 from public.profiles where role = 'SUPER_ADMIN')
     and coalesce((select (value ->> 'allow_self_signup')::boolean from public.site_settings where key = 'auth_options'), false)
         is not true then
    raise exception 'Email % chưa được mời tham gia hệ thống', new.email using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    v_invite.role
  );

  if v_invite.id is not null then
    update public.invitations set accepted_at = now() where id = v_invite.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bình luận: luôn chờ duyệt; tên hiển thị do CSDL lấy từ hồ sơ, người gửi không tự đặt được
-- ---------------------------------------------------------------------------

insert into public.module_settings (module_key) values ('comments');

insert into public.role_permissions (role, permission) values
  ('SUPER_ADMIN', 'comments.manage'),
  ('ADMIN', 'comments.manage');

create table public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  content text not null check (length(trim(content)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz
);

create index news_comments_news_idx on public.news_comments (news_id, created_at) where status = 'approved';
create index news_comments_status_idx on public.news_comments (status, created_at desc);
create index news_comments_user_idx on public.news_comments (user_id, created_at desc);

create function private.guard_news_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
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
    if (select count(*) from public.news_comments c
        where c.user_id = v_uid and c.created_at > now() - interval '10 minutes') >= 5 then
      raise exception 'Bạn gửi bình luận quá nhanh. Vui lòng thử lại sau ít phút.' using errcode = '54000';
    end if;
    return new;
  end if;
  -- Người duyệt chỉ đổi trạng thái, không sửa lời của người khác
  if new.news_id is distinct from old.news_id or new.user_id is distinct from old.user_id
     or new.author_name is distinct from old.author_name or new.content is distinct from old.content then
    raise exception 'Chỉ được đổi trạng thái bình luận' using errcode = '42501';
  end if;
  new.moderated_by := v_uid;
  new.moderated_at := now();
  return new;
end;
$$;

create trigger news_comments_guard before insert or update on public.news_comments
  for each row execute function private.guard_news_comment();
create trigger audit after update or delete on public.news_comments
  for each row execute function private.audit_row();

alter table public.news_comments enable row level security;
create policy "Xem bình luận" on public.news_comments
  for select to anon, authenticated using (
    status = 'approved' or user_id = (select auth.uid()) or public.has_permission('comments.manage')
  );
create policy "Gửi bình luận" on public.news_comments
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
    and exists (select 1 from public.news n where n.id = news_id and n.status = 'published' and n.published_at <= now())
  );
create policy "Duyệt bình luận" on public.news_comments
  for update to authenticated
  using (public.has_permission('comments.manage'))
  with check (public.has_permission('comments.manage'));
create policy "Xóa bình luận" on public.news_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('comments.manage'));

grant select on public.news_comments to anon;
grant select, insert, update, delete on public.news_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Sao lưu: thêm các bảng mới của 0.10.0 (bản sao lưu cũ không có bảng này thì bỏ qua)
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
    'videos', 'resources', 'work_plans', 'work_plan_items', 'news_comments'
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
