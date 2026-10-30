-- Trang chủ: slide, cấu hình bố cục & dòng chữ chạy (ADMIN sửa được), bộ đếm truy cập
begin;
select plan(14);

-- ===================== KHÁCH =====================
select tests.as_postgres();
update public.homepage_slides set is_active = false where sort_order = 3;
select tests.as_anon();

select ok((select count(*) from public.homepage_slides) >= 1, 'Khách xem được slide');
select is((select count(*)::int from public.homepage_slides where not is_active), 0, 'Khách không thấy slide đang ẩn');
select ok(exists (select 1 from public.site_settings where key = 'homepage'), 'Khách đọc được cấu hình trang chủ');
select throws_ok($$insert into public.homepage_slides (title, image_path) values ('x', 'x.jpg')$$,
  '42501', null, 'Khách không thêm được slide');

-- ===================== EDITOR =====================
select tests.as_user('editor@demo.local');
select throws_ok($$insert into public.homepage_slides (title, image_path) values ('x', 'x.jpg')$$,
  '42501', null, 'Editor không thêm được slide');
update public.site_settings set value = value || '{"show_slides": false}' where key = 'homepage';
select is((select value -> 'show_slides' from public.site_settings where key = 'homepage'), 'true'::jsonb,
  'Editor không sửa được bố cục trang chủ');

-- ===================== ADMIN =====================
select tests.as_user('admin@demo.local');
select lives_ok(
  $$insert into public.homepage_slides (title, image_path, link_url) values ('Slide mới', 'seed/slide-stem.jpg', '/tin-tuc')$$,
  'Admin thêm được slide');
select throws_ok(
  $$insert into public.homepage_slides (title, image_path, link_url) values ('Sai', 'a.jpg', 'javascript:alert(1)')$$,
  '23514', null, 'Liên kết slide phải là / hoặc http(s)');
select lives_ok($$update public.site_settings set value = value || '{"show_slides": false}' where key = 'homepage'$$,
  'Admin sửa được bố cục trang chủ');
select is((select value -> 'show_slides' from public.site_settings where key = 'homepage'), 'false'::jsonb,
  'Bố cục trang chủ đã được lưu');
select lives_ok($$update public.site_settings set value = value || '{"enabled": false}' where key = 'marquee'$$,
  'Admin sửa được dòng chữ chạy');
update public.site_settings set value = value || '{"primary_color": "#000000"}' where key = 'branding';
select isnt((select value ->> 'primary_color' from public.site_settings where key = 'branding'), '#000000',
  'Admin vẫn không sửa được màu sắc/nhận diện');

-- ===================== BỘ ĐẾM =====================
select tests.as_postgres();
delete from public.site_visits_daily where day is not null;
insert into public.site_visits_daily (day, visits) values
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 5),
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1, 7);
update public.site_settings set value = value || '{"visit_counter_offset": 1000}' where key = 'homepage';
select tests.as_anon();
select is(public.get_visit_stats() ->> 'total', '1012', 'Tổng lượt = lượt thật + số khởi điểm');
select is(
  (public.get_visit_stats() ->> 'today') || '/' || (public.get_visit_stats() ->> 'yesterday'), '5/7',
  'Có số lượt hôm nay và hôm qua');

select * from finish();
rollback;
