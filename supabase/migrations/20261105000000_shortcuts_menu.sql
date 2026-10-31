-- Giai đoạn 8.5, schema 0.9.0: menu Lối tắt cho khối ô icon trên trang chủ.
-- Bố cục trang chủ (vùng, kiểu hiển thị, mẫu) nằm trong site_settings.homepage và được chuẩn hóa khi đọc
-- nên không cần đổi dữ liệu; khối Lối tắt tắt sẵn để trường đang chạy không đổi giao diện khi nâng cấp.

alter table public.menus drop constraint menus_location_check;
alter table public.menus add constraint menus_location_check
  check (location in ('header', 'footer', 'quick_links', 'mobile_bar', 'shortcuts'));

create function private.ensure_shortcuts_menu()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu uuid;
begin
  insert into public.menus (code, name, location)
  values ('shortcuts', 'Lối tắt trang chủ', 'shortcuts')
  on conflict (code) do nothing
  returning id into v_menu;
  if v_menu is null then
    return;
  end if;
  insert into public.menu_items (menu_id, title, url, icon, sort_order) values
    (v_menu, 'Tin tức', '/tin-tuc', 'newspaper', 0),
    (v_menu, 'Thông báo', '/thong-bao', 'bell', 1),
    (v_menu, 'Văn bản', '/van-ban', 'file-text', 2),
    (v_menu, 'Thư viện ảnh', '/thu-vien-anh', 'images', 3);
end;
$$;

revoke execute on function private.ensure_shortcuts_menu() from public, anon, authenticated;

select private.ensure_shortcuts_menu();

-- restore_backup đã gọi hàm này sau khi khôi phục; bản sao lưu cũ chưa có menu Lối tắt thì tạo lại ở đây
-- để không phải chép lại toàn bộ restore_backup.
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

update public.app_meta set value = '0.9.0', updated_at = now() where key = 'schema_version';
