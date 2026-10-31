-- Giai đoạn 8.6, schema 0.10.0 (đợt A): đầu trang, chân trang, lối tắt có ảnh, các tùy chọn mới của trang chủ.
-- Trường đang chạy giữ nguyên giao diện (mọi tùy chọn mới tắt); bản cài mới chưa có SUPER_ADMIN nên bật sẵn.

alter table public.menu_items add column image_path text;

insert into public.site_settings (key, value)
select 'site_chrome', jsonb_build_object(
  'header_social', v.fresh,
  'nav_search', v.fresh,
  'footer_link_icons', v.fresh,
  'footer_connect_icons', v.fresh,
  'footer_info_lines', '[]'::jsonb
)
from (select not exists (select 1 from public.profiles where role = 'SUPER_ADMIN') as fresh) v
on conflict (key) do nothing;

update public.site_settings
set value = value || jsonb_build_object(
  'hero', 'portal',
  'highlight_latest_announcement', true,
  'documents_ticker', true,
  'sections', coalesce(value -> 'sections', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('key', 'shortcuts', 'enabled', true, 'zone', 'top'))
)
where key = 'homepage'
  and not exists (select 1 from public.profiles where role = 'SUPER_ADMIN');

drop policy "Quản lý trang chủ và dòng chữ chạy" on public.site_settings;
create policy "Quản lý trang chủ, chữ chạy, đầu và chân trang" on public.site_settings
  for update to authenticated
  using (key in ('homepage', 'marquee', 'site_chrome') and public.has_permission('homepage.manage'))
  with check (key in ('homepage', 'marquee', 'site_chrome') and public.has_permission('homepage.manage'));

