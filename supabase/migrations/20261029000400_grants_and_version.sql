-- eSchool Portal: quyền truy cập bảng/hàm & phiên bản schema 0.2.0
--
-- Quyền mặc định của Supabase khác nhau giữa các phiên bản/nền tảng, nên thu hồi hết
-- rồi cấp tường minh cho từng bảng; RLS quyết định từng dòng.
-- QUY ƯỚC: mỗi bảng mới trong migration sau phải tự GRANT (mặc định đã đóng).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Khách: tên & ảnh nhân sự (hiện tác giả bài viết), không có email/vai trò
grant select (id, full_name, avatar_url) on public.profiles to anon;

-- Khách: chỉ đọc các bảng nội dung công khai
grant select on
  public.role_permissions,
  public.site_settings,
  public.module_settings,
  public.news_categories,
  public.news_tags,
  public.news,
  public.news_tag_map,
  public.announcements,
  public.documents,
  public.pages,
  public.menus,
  public.menu_items,
  public.media,
  public.albums,
  public.album_items
to anon;
-- profiles: khách chỉ được 3 cột (đã cấp trong migration core)

-- Người đăng nhập: đọc/ghi các bảng nghiệp vụ, RLS giới hạn từng dòng
grant select on public.role_permissions, public.site_visits_daily, public.audit_logs to authenticated;
grant select, update on public.profiles, public.site_settings, public.module_settings to authenticated;
grant select, insert, update, delete on
  public.invitations,
  public.news_categories,
  public.news_tags,
  public.news,
  public.news_tag_map,
  public.announcements,
  public.documents,
  public.pages,
  public.menus,
  public.menu_items,
  public.media,
  public.albums,
  public.album_items
to authenticated;

-- Hàm trong private mặc định ai cũng gọi được; chỉ mở những hàm cần cho khách/nhân sự
revoke execute on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
-- vi_unaccent dùng trong cột generated (khi nhân sự lưu bài) và trong search_news (khách tìm kiếm)
grant execute on function private.vi_unaccent(text) to anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

update public.app_meta set value = '0.2.0', updated_at = now() where key = 'schema_version';
