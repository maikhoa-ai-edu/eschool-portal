-- eSchool Portal: lõi hệ thống
-- Vai trò & quyền, hồ sơ người dùng, lời mời, cài đặt lần đầu, cấu hình trường,
-- bật/tắt module, bộ đếm truy cập, nhật ký kiểm toán.
--
-- Nguyên tắc: mọi kiểm tra quyền nằm trong CSDL (RLS + trigger). Kết nối tin cậy
-- (postgres/service_role, auth.uid() rỗng) được bỏ qua các trigger chặn để quản trị trực tiếp.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists unaccent with schema extensions;

-- Bỏ dấu tiếng Việt, dùng được trong cột generated và index
create function private.vi_unaccent(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(input, '')))
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vai trò & quyền (cố định theo đặc tả; chỉ đổi qua migration)
-- ---------------------------------------------------------------------------

create table public.role_permissions (
  role text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'EDITOR')),
  permission text not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;
create policy "Ai cũng xem được ma trận quyền" on public.role_permissions
  for select to anon, authenticated using (true);

insert into public.role_permissions (role, permission)
select r.role, p.permission
from (values
  -- Quyền quản trị hệ thống: chỉ SUPER_ADMIN
  ('settings.manage', array['SUPER_ADMIN']),
  ('modules.manage', array['SUPER_ADMIN']),
  ('users.manage', array['SUPER_ADMIN']),
  ('audit.view', array['SUPER_ADMIN']),
  ('backup.manage', array['SUPER_ADMIN']),
  -- Quản lý & xuất bản nội dung: ADMIN trở lên
  ('news.edit_any', array['SUPER_ADMIN', 'ADMIN']),
  ('news.publish', array['SUPER_ADMIN', 'ADMIN']),
  ('news.delete', array['SUPER_ADMIN', 'ADMIN']),
  ('news.manage_taxonomy', array['SUPER_ADMIN', 'ADMIN']),
  ('announcements.manage', array['SUPER_ADMIN', 'ADMIN']),
  ('documents.manage', array['SUPER_ADMIN', 'ADMIN']),
  ('pages.manage', array['SUPER_ADMIN', 'ADMIN']),
  ('menus.manage', array['SUPER_ADMIN', 'ADMIN']),
  ('homepage.manage', array['SUPER_ADMIN', 'ADMIN']),
  ('media.manage', array['SUPER_ADMIN', 'ADMIN']),
  -- Soạn thảo: mọi nhân sự
  ('news.create', array['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  ('news.edit_own', array['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
  ('media.upload', array['SUPER_ADMIN', 'ADMIN', 'EDITOR'])
) as p(permission, roles)
cross join lateral unnest(p.roles) as r(role);

-- ---------------------------------------------------------------------------
-- Hồ sơ người dùng (1 vai trò / người)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Email luôn lưu chữ thường (Supabase Auth đã chuẩn hóa khi đăng ký)
  email text not null unique check (email = lower(email)),
  full_name text not null check (length(trim(full_name)) > 0),
  avatar_url text,
  phone text,
  role text check (role in ('SUPER_ADMIN', 'ADMIN', 'EDITOR')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role is not null;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Vai trò hiệu lực của người đang gọi (null nếu chưa đăng nhập / bị khóa / chưa có vai trò)
create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.is_active
$$;

create function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = (select auth.uid())
      and p.is_active
      and rp.permission = p_permission
  )
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() is not null
$$;

-- Kết nối tin cậy: chạy trực tiếp bằng postgres/service_role (không có JWT người dùng)
create function private.is_trusted_connection()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null and current_user not in ('anon', 'authenticated')
$$;

alter table public.profiles enable row level security;

-- Khách chỉ thấy tên & ảnh (để hiện tác giả bài viết); quyền cột cấp ở migration grants
create policy "Khách xem tên nhân sự đang hoạt động" on public.profiles
  for select to anon using (is_active);

create policy "Nhân sự xem hồ sơ" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_staff());

create policy "Tự sửa hồ sơ hoặc quản lý người dùng" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.has_permission('users.manage'))
  with check (id = (select auth.uid()) or public.has_permission('users.manage'));

-- Chặn tự nâng quyền; bảo vệ SUPER_ADMIN cuối cùng
create function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_connection()
     or current_setting('eschool.bootstrapping', true) = 'on' then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'Không được đổi email trực tiếp' using errcode = '42501';
  end if;

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if not public.has_permission('users.manage') then
      raise exception 'Không có quyền đổi vai trò hoặc trạng thái tài khoản' using errcode = '42501';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'Không thể tự đổi vai trò hoặc tự khóa tài khoản của mình' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

create function private.guard_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_connection() then
    return null;
  end if;
  if not exists (select 1 from public.profiles where role = 'SUPER_ADMIN' and is_active)
     and exists (select 1 from private.install_state where completed_at is not null) then
    raise exception 'Hệ thống phải còn ít nhất một Quản trị viên cấp cao' using errcode = '42501';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trạng thái cài đặt & mã cài đặt (schema private: API không truy cập được)
-- ---------------------------------------------------------------------------

create table private.install_state (
  id boolean primary key default true check (id),
  install_code text,
  bootstrapped_at timestamptz,
  completed_at timestamptz
);

-- Mã ngẫu nhiên; install.sql in mã này ra để người cài dán vào trình cài đặt
insert into private.install_state (install_code)
values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

create constraint trigger profiles_keep_super_admin
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function private.guard_last_super_admin();

create function public.get_install_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'has_super_admin', exists (select 1 from public.profiles where role = 'SUPER_ADMIN'),
    'completed', s.completed_at is not null
  )
  from private.install_state s
$$;

-- Người dùng vừa đăng ký + mã cài đặt đúng => trở thành SUPER_ADMIN đầu tiên
create function public.bootstrap_super_admin(p_install_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_state private.install_state;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập trước' using errcode = '42501';
  end if;

  select * into v_state from private.install_state for update;

  if exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'Hệ thống đã có Quản trị viên cấp cao' using errcode = '42501';
  end if;
  if v_state.install_code is null
     or upper(trim(coalesce(p_install_code, ''))) <> v_state.install_code then
    raise exception 'Mã cài đặt không đúng' using errcode = '42501';
  end if;

  -- Cờ chỉ sống trong giao dịch này, cho phép guard_profile_update bỏ qua đúng một lần
  perform set_config('eschool.bootstrapping', 'on', true);
  update public.profiles set role = 'SUPER_ADMIN', is_active = true where id = v_uid;
  if not found then
    raise exception 'Không tìm thấy hồ sơ người dùng' using errcode = 'P0002';
  end if;
  perform set_config('eschool.bootstrapping', 'off', true);

  update private.install_state set install_code = null, bootstrapped_at = now();
end;
$$;

create function public.complete_install()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'SUPER_ADMIN' then
    raise exception 'Chỉ Quản trị viên cấp cao được hoàn tất cài đặt' using errcode = '42501';
  end if;
  update private.install_state set completed_at = coalesce(completed_at, now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Lời mời: chỉ email được mời mới đăng ký được (trừ lúc chưa có admin)
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email like '%_@_%'),
  role text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'EDITOR')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz
);

create unique index invitations_open_email_idx on public.invitations (email) where accepted_at is null;

alter table public.invitations enable row level security;
create policy "Quản lý lời mời" on public.invitations
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage') and invited_by = (select auth.uid()));

create function private.guard_invitation_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  if new.role = 'SUPER_ADMIN' and not private.is_trusted_connection()
     and public.current_user_role() is distinct from 'SUPER_ADMIN' then
    raise exception 'Chỉ Quản trị viên cấp cao được mời SUPER_ADMIN' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger invitations_guard before insert or update on public.invitations
  for each row execute function private.guard_invitation_role();

-- Tạo hồ sơ khi có tài khoản mới trong auth.users
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite
  from public.invitations
  where email = lower(new.email) and accepted_at is null and expires_at > now()
  for update;

  if v_invite.id is null
     and exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'Email % chưa được mời tham gia hệ thống', new.email using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_invite.role
  );

  if v_invite.id is not null then
    update public.invitations set accepted_at = now() where id = v_invite.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Cấu hình trường (khóa cố định; không cho tạo khóa mới qua API)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function private.set_updated_at();

alter table public.site_settings enable row level security;
create policy "Đọc cấu hình công khai" on public.site_settings
  for select to anon, authenticated using (is_public or public.has_permission('settings.manage'));
create policy "Sửa cấu hình" on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Giá trị trung tính; trình cài đặt sẽ điền thông tin thật của từng trường
insert into public.site_settings (key, value) values
  ('school_identity', jsonb_build_object(
    'school_name', 'Tên trường',
    'short_name', '',
    'governing_body', '',
    'slogan', '',
    'address', '',
    'phone', '',
    'email', '',
    'principal', '',
    'facebook_url', '',
    'youtube_url', '',
    'zalo_url', ''
  )),
  ('branding', jsonb_build_object(
    'primary_color', '#002B66',
    'primary_light_color', '#003B8E',
    'accent_color', '#D97706',
    'logo_url', null,
    'favicon_url', null,
    'banner_url', null
  )),
  ('seo', jsonb_build_object(
    'title_pattern', '%s | {school_name}',
    'default_description', '',
    'default_og_image', null,
    'google_site_verification', ''
  )),
  ('marquee', jsonb_build_object('enabled', false, 'items', '[]'::jsonb)),
  ('footer', jsonb_build_object('extra_html', ''));

-- ---------------------------------------------------------------------------
-- Bật/tắt module
-- ---------------------------------------------------------------------------

create table public.module_settings (
  module_key text primary key,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger module_settings_updated_at before update on public.module_settings
  for each row execute function private.set_updated_at();

alter table public.module_settings enable row level security;
create policy "Ai cũng xem trạng thái module" on public.module_settings
  for select to anon, authenticated using (true);
create policy "Bật tắt module" on public.module_settings
  for update to authenticated
  using (public.has_permission('modules.manage'))
  with check (public.has_permission('modules.manage'));

insert into public.module_settings (module_key) values
  ('news'), ('announcements'), ('documents'), ('albums'), ('pages');

-- ---------------------------------------------------------------------------
-- Bộ đếm truy cập (theo ngày)
-- ---------------------------------------------------------------------------

create table public.site_visits_daily (
  day date primary key,
  visits bigint not null default 0 check (visits >= 0)
);

alter table public.site_visits_daily enable row level security;
create policy "Nhân sự xem thống kê truy cập" on public.site_visits_daily
  for select to authenticated using (public.is_staff());

-- Trình duyệt gọi 1 lần mỗi phiên
create function public.record_visit()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.site_visits_daily (day, visits)
  values ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 1)
  on conflict (day) do update set visits = public.site_visits_daily.visits + 1
$$;

create function public.get_visit_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', coalesce(sum(visits), 0),
    'today', coalesce(sum(visits) filter (
      where day = (now() at time zone 'Asia/Ho_Chi_Minh')::date), 0)
  )
  from public.site_visits_daily
$$;

-- ---------------------------------------------------------------------------
-- Nhật ký kiểm toán: chỉ trigger được ghi, không ai sửa/xóa qua API
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,
  changed_fields text[],
  summary text
);

create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;
create policy "Xem nhật ký" on public.audit_logs
  for select to authenticated using (public.has_permission('audit.view'));

-- Ghi lại ai đổi gì (tên cột thay đổi + tiêu đề), không chép toàn bộ nội dung
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
    from jsonb_object_keys(v_new) as k
    where k not in ('updated_at', 'search_vector', 'view_count', 'download_count')
      and v_new -> k is distinct from v_old -> k;
    if v_changed is null then
      return null;
    end if;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, changed_fields, summary)
  values (
    auth.uid(),
    public.current_user_role(),
    tg_op,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'module_key'),
    v_changed,
    left(coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'email', v_row ->> 'key', v_row ->> 'module_key'), 200)
  );
  return null;
end;
$$;

create trigger audit after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.invitations
  for each row execute function private.audit_row();
create trigger audit after update on public.site_settings
  for each row execute function private.audit_row();
create trigger audit after update on public.module_settings
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------

-- Supabase mặc định cấp EXECUTE cho anon/authenticated; thu hồi rồi cấp lại có chủ đích
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.current_user_role(),
  public.has_permission(text),
  public.is_staff(),
  public.get_install_status(),
  public.record_visit(),
  public.get_visit_stats(),
  public.get_schema_version()
to anon, authenticated;
grant execute on function
  public.bootstrap_super_admin(text),
  public.complete_install()
to authenticated;
