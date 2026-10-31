-- Giai đoạn 8.6, schema 0.10.0: nhóm tài khoản nhà trường, tạo tài khoản có mật khẩu ngẫu nhiên (không có mật khẩu
-- mặc định chung), buộc đổi mật khẩu lần đầu; khối cột phải Kế hoạch tháng, Video mới, Liên kết website.

create extension if not exists pgcrypto with schema extensions;

alter table public.role_permissions drop constraint role_permissions_role_check;
alter table public.role_permissions add constraint role_permissions_role_check check (role in
  ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'BAN_GIAM_HIEU', 'TO_TRUONG', 'DOAN_THE', 'GIAO_VIEN', 'NHAN_VIEN'));
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in
  ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'BAN_GIAM_HIEU', 'TO_TRUONG', 'DOAN_THE', 'GIAO_VIEN', 'NHAN_VIEN'));
alter table public.invitations drop constraint invitations_role_check;
alter table public.invitations add constraint invitations_role_check check (role in
  ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'BAN_GIAM_HIEU', 'TO_TRUONG', 'DOAN_THE', 'GIAO_VIEN', 'NHAN_VIEN'));

-- Ban giám hiệu: toàn bộ quyền nội dung như ADMIN, không có quyền quản trị hệ thống
insert into public.role_permissions (role, permission)
select 'BAN_GIAM_HIEU', permission from public.role_permissions where role = 'ADMIN';

insert into public.role_permissions (role, permission)
select g.role, p.permission
from (values
  ('TO_TRUONG', array['documents.manage', 'plans.manage']),
  ('DOAN_THE', array['announcements.manage', 'media.manage']),
  ('GIAO_VIEN', array[]::text[]),
  ('NHAN_VIEN', array['documents.manage', 'announcements.manage'])
) as g(role, extra)
cross join lateral unnest(array['news.create', 'news.edit_own', 'media.upload'] || g.extra) as p(permission);

alter table public.profiles add column must_change_password boolean not null default false;

-- Người dùng đổi mật khẩu xong thì hết bị buộc đổi; cờ do máy chủ xóa
create function private.clear_must_change_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set must_change_password = false
  where id = new.id and must_change_password;
  return new;
end;
$$;

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.clear_must_change_password();

create function private.random_password()
returns text
language sql
volatile
set search_path = ''
as $$
  -- Bỏ các ký tự dễ nhầm (0, O, 1, l, I) vì mật khẩu thường được đọc hoặc chép tay
  select string_agg(substr('abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    get_byte(b.bytes, i) % 55 + 1, 1), '')
  from (select extensions.gen_random_bytes(14) as bytes) b, generate_series(0, 13) as i
$$;

revoke execute on function private.random_password() from public, anon, authenticated;

/** Tạo tài khoản đăng nhập được ngay; mật khẩu chỉ trả về một lần và không được lưu ở dạng đọc được. */
create function public.create_staff_account(p_email text, p_full_name text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_name text := trim(p_full_name);
  v_password text := private.random_password();
begin
  if not public.has_permission('users.manage') then
    raise exception 'Không có quyền tạo tài khoản' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email % không hợp lệ', v_email using errcode = '22023';
  end if;
  if coalesce(v_name, '') = '' then
    raise exception 'Vui lòng nhập họ tên' using errcode = '22023';
  end if;
  if not exists (select 1 from public.role_permissions where role = p_role) then
    raise exception 'Vai trò không hợp lệ' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Email % đã có tài khoản', v_email using errcode = '23505';
  end if;

  -- Hồ sơ tạo ngay dưới đây nên trigger đăng ký không cần kiểm tra lời mời
  perform set_config('eschool.restoring', 'on', true);
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', null, now(), now());
  perform set_config('eschool.restoring', 'off', true);

  insert into public.profiles (id, email, full_name, role, must_change_password)
  values (v_id, v_email, v_name, p_role, true);

  return jsonb_build_object('id', v_id, 'email', v_email, 'full_name', v_name, 'role', p_role, 'password', v_password);
end;
$$;

create function public.reset_staff_password(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_password text := private.random_password();
begin
  if not public.has_permission('users.manage') then
    raise exception 'Không có quyền cấp lại mật khẩu' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'Không tìm thấy tài khoản' using errcode = 'P0002';
  end if;
  if p_user_id = auth.uid() or v_profile.role = 'SUPER_ADMIN' then
    raise exception 'Không cấp lại mật khẩu cho quản trị viên cấp cao tại đây' using errcode = '42501';
  end if;

  update auth.users set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf', 10)), updated_at = now()
  where id = p_user_id;
  -- Mật khẩu cũ có thể đã lộ: đăng xuất mọi nơi
  delete from auth.sessions where user_id = p_user_id;
  update public.profiles set must_change_password = true where id = p_user_id;

  return jsonb_build_object('id', p_user_id, 'email', v_profile.email, 'full_name', v_profile.full_name,
    'role', v_profile.role, 'password', v_password);
end;
$$;

revoke execute on function public.create_staff_account(text, text, text) from public, anon;
revoke execute on function public.reset_staff_password(uuid) from public, anon;
grant execute on function public.create_staff_account(text, text, text) to authenticated;
grant execute on function public.reset_staff_password(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Menu Liên kết website cho khối cột phải (khối tắt với trường đang chạy, bật với bản cài mới)
-- ---------------------------------------------------------------------------

alter table public.menus drop constraint menus_location_check;
alter table public.menus add constraint menus_location_check
  check (location in ('header', 'footer', 'quick_links', 'mobile_bar', 'shortcuts', 'web_links'));

create function private.ensure_web_links_menu()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu uuid;
begin
  insert into public.menus (code, name, location)
  values ('web_links', 'Liên kết website', 'web_links')
  on conflict (code) do nothing
  returning id into v_menu;
  if v_menu is null then
    return;
  end if;
  insert into public.menu_items (menu_id, title, url, icon, open_in_new_tab, sort_order) values
    (v_menu, 'Bộ Giáo dục và Đào tạo', 'https://moet.gov.vn', 'landmark', true, 0),
    (v_menu, 'vnEdu', 'https://vnedu.vn', 'globe', true, 1),
    (v_menu, 'SMAS', 'https://smas.edu.vn', 'globe', true, 2);
end;
$$;

revoke execute on function private.ensure_web_links_menu() from public, anon, authenticated;

select private.ensure_web_links_menu();

-- restore_backup gọi hàm này sau khi khôi phục; bản sao lưu cũ chưa có menu thì tạo lại
create or replace function private.ensure_mobile_menu()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu uuid;
begin
  perform private.ensure_shortcuts_menu();
  perform private.ensure_web_links_menu();
  insert into public.menus (code, name, location)
  values ('mobile', 'Thanh đáy điện thoại', 'mobile_bar')
  on conflict (code) do nothing
  returning id into v_menu;
  if v_menu is null then
    return;
  end if;
  insert into public.menu_items (menu_id, title, url, icon, sort_order) values
    (v_menu, 'Trang chủ', '/', 'home', 0),
    (v_menu, 'Tin tức', '/tin-tuc', 'newspaper', 1),
    (v_menu, 'Thông báo', '/thong-bao', 'bell', 2),
    (v_menu, 'Văn bản', '/van-ban', 'file-text', 3),
    (v_menu, 'Liên hệ', '/trang/lien-he', 'phone', 4);
end;
$$;

update public.site_settings
set value = value || jsonb_build_object(
  'sections', coalesce(value -> 'sections', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('key', 'plan_month', 'enabled', true, 'zone', 'sidebar'),
    jsonb_build_object('key', 'latest_video', 'enabled', true, 'zone', 'sidebar'),
    jsonb_build_object('key', 'web_links', 'enabled', true, 'zone', 'sidebar')
  )
)
where key = 'homepage'
  and not exists (select 1 from public.profiles where role = 'SUPER_ADMIN');
