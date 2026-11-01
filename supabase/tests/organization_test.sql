-- Cơ cấu tổ chức: khách chỉ đọc người đang hiện, chỉ quản trị viên được sửa. Sự kiện kế hoạch luôn có ngày hợp lệ.
begin;
select plan(13);

-- ===================== KHÁCH =====================
select tests.as_anon();
select ok((select count(*) from public.org_units) > 0, 'Khách đọc được bộ phận');
select is((select count(*)::int from public.org_members where full_name = 'Giáo viên Đang Ẩn'), 0, 'Khách không đọc được người đang ẩn');
select ok((select count(*) from public.org_members where full_name = 'Nguyễn Văn An') = 1, 'Khách đọc được người đang hiện');
select throws_ok($$insert into public.org_units (name) values ('X')$$, '42501', null, 'Khách không thêm được bộ phận');
select throws_ok($$update public.org_members set full_name = 'X' where true$$, '42501', null, 'Khách không sửa được thành viên');

-- ===================== NHÂN VIÊN KHÔNG CÓ QUYỀN =====================
select tests.as_user('editor@demo.local');
select is((select count(*)::int from public.org_members where full_name = 'Giáo viên Đang Ẩn'), 0, 'Biên tập viên không đọc được người đang ẩn');
select throws_ok($$insert into public.org_units (name) values ('X')$$, '42501', null, 'Biên tập viên không thêm được bộ phận');

-- ===================== QUẢN TRỊ VIÊN =====================
select tests.as_user('admin@demo.local');
select is((select count(*)::int from public.org_members where full_name = 'Giáo viên Đang Ẩn'), 1, 'Quản trị viên thấy người đang ẩn để sửa');
select lives_ok($$insert into public.org_units (name) values ('Tổ mới')$$, 'Quản trị viên thêm được bộ phận');
select throws_ok(
  $$insert into public.org_members (unit_id, full_name, start_year) values ('00000000-0000-0000-0000-0000000000e1', 'Năm sai', 1800)$$,
  '23514', null, 'Năm vào ngành ngoài khoảng bị từ chối');

-- ===================== SỰ KIỆN KẾ HOẠCH =====================
select throws_ok(
  $$insert into public.work_plan_items (plan_id, content, is_important) values ('00000000-0000-0000-0000-0000000000d9', 'Thiếu ngày', true)$$,
  '23514', null, 'Sự kiện quan trọng phải có ngày');
select throws_ok(
  $$insert into public.work_plan_items (plan_id, content, is_important, event_date, event_end_date)
    values ('00000000-0000-0000-0000-0000000000d9', 'Ngày ngược', true, '2026-11-20', '2026-11-10')$$,
  '23514', null, 'Ngày kết thúc không được trước ngày bắt đầu');

-- ===================== TRANG =====================
select throws_ok($$update public.pages set template = 'la' where slug = 'gioi-thieu'$$, '23514', null, 'Bố cục lạ bị từ chối');

select * from finish();
rollback;
