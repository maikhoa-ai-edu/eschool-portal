-- Ma trận quyền theo 4 vai trò, dựa trên dữ liệu seed.sql
begin;
select no_plan();

-- ===================== KHÁCH (anon) =====================
select tests.as_anon();

select is((select count(*)::int from public.news), 2, 'Khách chỉ thấy 2 tin đã đăng, không thấy tin chờ duyệt');
select is((select count(*)::int from public.announcements), 1, 'Khách không thấy thông báo nháp');
select is((select count(*)::int from public.pages), 2, 'Khách thấy trang đã đăng');
select ok((select count(*) from public.site_settings) >= 5, 'Khách đọc được cấu hình công khai');
select lives_ok('select full_name from public.profiles', 'Khách đọc được tên nhân sự');
select throws_ok('select email from public.profiles', '42501', null, 'Khách không đọc được email nhân sự');
select throws_ok('select * from public.audit_logs', '42501', null, 'Khách không truy cập được nhật ký');
select throws_ok('select * from public.invitations', '42501', null, 'Khách không truy cập được lời mời');
select throws_ok('select * from public.site_visits_daily', '42501', null, 'Khách không đọc chi tiết truy cập');
select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id)
    values ('x', 'x', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'Khách không viết được tin');
select throws_ok($$select public.bootstrap_super_admin('ABC')$$, '42501', null, 'Khách không gọi được bootstrap');
select is((public.get_install_status() ->> 'has_super_admin')::boolean, true, 'Trạng thái cài đặt: đã có admin');
select lives_ok('select public.record_visit()', 'Khách ghi nhận lượt truy cập');
select ok((public.get_visit_stats() ->> 'total')::int >= 1, 'Thống kê truy cập tăng');
select is(
  (select count(*)::int from public.search_news('hoi thi hoc sinh gioi')), 1,
  'Tìm kiếm không dấu tìm ra bài có dấu');
select is((select count(*)::int from public.search_news('tuyen sinh lop 10')), 0,
  'Tìm kiếm không trả về tin chưa đăng');

-- ===================== EDITOR =====================
select tests.as_user('editor@demo.local');

select is((select count(*)::int from public.news), 3, 'Editor thấy tin đã đăng + tin của mình');
select lives_ok(
  $$insert into public.news (title, slug, category_id, author_id, status)
    values ('Bài nháp của editor', 'bai-nhap-cua-editor', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000a3', 'draft')$$,
  'Editor viết được bài nháp');
select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id)
    values ('Mạo danh', 'mao-danh', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'Editor không viết bài dưới tên người khác');
select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id, status)
    values ('Tự đăng', 'tu-dang', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3', 'published')$$,
  '42501', null, 'Editor không tự xuất bản được');
select lives_ok(
  $$update public.news set status = 'pending' where slug = 'bai-nhap-cua-editor'$$,
  'Editor gửi duyệt bài của mình');
select throws_ok(
  $$update public.news set status = 'published' where slug = 'bai-nhap-cua-editor'$$,
  '42501', null, 'Editor không tự duyệt bài');

update public.news set title = 'Bị sửa trái phép' where slug = 'khai-giang-nam-hoc-2026-2027';
select is((select title from public.news where slug = 'khai-giang-nam-hoc-2026-2027'),
  'Khai giảng năm học 2026 - 2027', 'Editor không sửa được bài đã đăng của người khác');

select throws_ok(
  $$update public.profiles set role = 'SUPER_ADMIN' where email = 'editor@demo.local'$$,
  '42501', null, 'Editor không tự nâng quyền');
update public.site_settings set value = '{}' where key = 'school_identity';
select isnt((select value from public.site_settings where key = 'school_identity'), '{}'::jsonb,
  'Editor không sửa được cấu hình trường');
select throws_ok(
  $$insert into public.announcements (title, content) values ('x', 'x')$$,
  '42501', null, 'Editor không tạo thông báo');
select lives_ok($$insert into public.news_tags (name, slug) values ('Khai giảng', 'khai-giang')$$,
  'Editor tạo được thẻ khi soạn bài');
select is((select count(*)::int from public.audit_logs), 0, 'Editor không xem nhật ký');

-- ===================== ADMIN =====================
select tests.as_user('admin@demo.local');

select lives_ok(
  $$update public.news set status = 'published' where slug = 'thong-tin-tuyen-sinh-lop-6-va-lop-10'$$,
  'Admin duyệt và đăng bài của editor');
select isnt((select published_at from public.news where slug = 'thong-tin-tuyen-sinh-lop-6-va-lop-10'), null,
  'Ngày đăng được tự gán khi xuất bản');
select is((select published_by from public.news where slug = 'thong-tin-tuyen-sinh-lop-6-va-lop-10'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, 'Người duyệt được ghi nhận');
select lives_ok($$insert into public.announcements (title, content, status) values ('Họp phụ huynh', 'Nội dung', 'published')$$,
  'Admin đăng thông báo');
update public.site_settings set value = '{}' where key = 'school_identity';
select isnt((select value from public.site_settings where key = 'school_identity'), '{}'::jsonb,
  'Admin không sửa được cấu hình trường');
-- RLS bỏ qua dòng không được phép (không báo lỗi), nên kiểm tra kết quả
update public.profiles set role = 'ADMIN' where email = 'editor@demo.local';
select tests.as_postgres();
select is((select role from public.profiles where email = 'editor@demo.local'), 'EDITOR',
  'Admin không đổi được vai trò người khác');
select tests.as_user('admin@demo.local');
select is((select count(*)::int from public.audit_logs), 0, 'Admin không xem nhật ký');

-- ===================== SUPER_ADMIN =====================
select tests.as_user('superadmin@demo.local');

select lives_ok(
  $$update public.site_settings set value = value || '{"phone":"0297 123 456"}' where key = 'school_identity'$$,
  'Super admin sửa cấu hình trường');
select is((select value ->> 'phone' from public.site_settings where key = 'school_identity'), '0297 123 456',
  'Cấu hình đã được lưu');
select lives_ok($$update public.module_settings set is_enabled = false where module_key = 'albums'$$,
  'Super admin tắt module');
select lives_ok($$update public.profiles set role = 'ADMIN' where email = 'editor@demo.local'$$,
  'Super admin đổi vai trò');
select throws_ok(
  $$update public.profiles set role = 'EDITOR' where email = 'superadmin@demo.local'$$,
  '42501', null, 'Không tự hạ quyền của chính mình');
select lives_ok(
  $$insert into public.invitations (email, role, invited_by)
    values ('giaovien@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a1')$$,
  'Super admin tạo lời mời');
select ok((select count(*) from public.audit_logs) > 0, 'Super admin xem được nhật ký');
select ok(exists (
  select 1 from public.audit_logs
  where table_name = 'news' and action = 'UPDATE'
    and actor_id = '00000000-0000-0000-0000-0000000000a2'
    and 'status' = any (changed_fields)
), 'Nhật ký ghi lại admin đã duyệt bài');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'Không ai xóa được nhật ký');

select * from finish();
rollback;
