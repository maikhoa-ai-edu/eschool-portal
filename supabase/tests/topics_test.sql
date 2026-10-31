-- Chuyên đề, icon menu, thanh menu đáy
begin;
select plan(18);

-- ===================== QUYỀN CHUYÊN ĐỀ =====================
select tests.as_postgres();
insert into public.topics (title, slug, status) values
  ('Chuyên đề nháp', 'chuyen-de-nhap', 'draft'),
  ('Chuyên đề đã đăng', 'chuyen-de-da-dang', 'published');

select tests.as_anon();
select is((select count(*)::int from public.topics where slug = 'chuyen-de-nhap'), 0, 'Khách không thấy chuyên đề nháp');
select is((select count(*)::int from public.topics where slug = 'chuyen-de-da-dang'), 1, 'Khách thấy chuyên đề đã đăng');
select throws_ok($$insert into public.topics (title, slug) values ('x', 'x')$$, '42501', null, 'Khách không tạo được chuyên đề');

select tests.as_user('editor@demo.local');
select is((select count(*)::int from public.topics where slug = 'chuyen-de-nhap'), 1, 'Biên tập viên xem trước được bản nháp');
select throws_ok($$insert into public.topics (title, slug) values ('x', 'x')$$, '42501', null, 'Biên tập viên không tạo được chuyên đề');
update public.topics set title = 'Bị sửa' where slug = 'chuyen-de-da-dang';
select is((select title from public.topics where slug = 'chuyen-de-da-dang'), 'Chuyên đề đã đăng', 'Biên tập viên không sửa được chuyên đề');

select tests.as_user('admin@demo.local');
select lives_ok($$insert into public.topics (title, slug, sections) values ('Mới', 'moi', '[{"id":"a","type":"quote"}]')$$, 'Admin tạo được chuyên đề');
select throws_ok($$insert into public.topics (title, slug, sections) values ('Sai', 'sai', '{}')$$, '23514', null, 'sections phải là mảng');
select throws_ok($$insert into public.topics (title, slug, hero_color) values ('Sai', 'sai', 'red')$$, '23514', null, 'Màu phải là mã hex');
select tests.as_postgres();
select ok(exists (select 1 from public.audit_logs where table_name = 'topics' and summary = 'Mới'), 'Tạo chuyên đề được ghi nhật ký');

-- ===================== MENU =====================
select tests.as_anon();
select ok(exists (select 1 from public.menu_items i join public.menus m on m.id = i.menu_id where m.code = 'mobile'),
  'Khách đọc được thanh menu đáy');
select is((select count(*)::int from public.menu_items i join public.menus m on m.id = i.menu_id where m.code = 'shortcuts'), 4,
  'Khách đọc được menu Lối tắt mặc định');

select tests.as_user('admin@demo.local');
select throws_ok($$update public.menu_items set icon = 'Sai Icon' where url = '/'$$, '23514', null, 'Icon phải là khóa hợp lệ');
select lives_ok($$update public.menu_items set icon = 'star' where url = '/'$$, 'Admin đổi được icon');

-- ===================== SAO LƯU =====================
select tests.as_user('superadmin@demo.local');
select set_config('tests.backup', public.export_backup()::text, true);
select ok(jsonb_array_length(current_setting('tests.backup')::jsonb -> 'data' -> 'topics') >= 2, 'Bản sao lưu có chuyên đề');

-- Bản sao lưu cũ: không có chuyên đề, không có menu đáy
select lives_ok($$select public.restore_backup(
  jsonb_set(
    jsonb_set(current_setting('tests.backup')::jsonb, '{data,topics}', '[]'),
    '{data,menus}',
    (select jsonb_agg(m) from jsonb_array_elements(current_setting('tests.backup')::jsonb -> 'data' -> 'menus') m where m ->> 'code' not in ('mobile', 'shortcuts'))
  ) #- '{data,menu_items}'
)$$, 'Khôi phục được bản sao lưu cũ');
select tests.as_anon();
select ok(exists (select 1 from public.menus where code = 'mobile'), 'Bản sao lưu cũ vẫn có menu đáy mặc định');
select ok(exists (select 1 from public.menus where code = 'shortcuts'), 'Bản sao lưu cũ vẫn có menu Lối tắt mặc định');

select * from finish();
rollback;
