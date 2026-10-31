-- Giai đoạn 8.6, schema 0.10.0: bản cài mới có sẵn mục Kế hoạch công tác trên menu chính.
-- Trường đang chạy giữ nguyên menu, tự thêm bằng Menu → Chọn nhanh liên kết.

update public.menu_items i
set sort_order = 7
from public.menus m
where i.menu_id = m.id and m.code = 'main' and i.url = '/trang/lien-he'
  and not exists (select 1 from public.profiles where role = 'SUPER_ADMIN');

insert into public.menu_items (menu_id, title, url, icon, sort_order)
select m.id, 'Kế hoạch công tác', '/ke-hoach', 'calendar', 6
from public.menus m
where m.code = 'main'
  and not exists (select 1 from public.profiles where role = 'SUPER_ADMIN');
