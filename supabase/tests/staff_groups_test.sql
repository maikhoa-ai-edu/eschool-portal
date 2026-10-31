-- Nhóm tài khoản: quyền theo nhóm, tạo tài khoản mật khẩu ngẫu nhiên, buộc đổi mật khẩu, cấp lại mật khẩu
begin;
select plan(19);

create function pg_temp.perm(p_role text, p_permission text)
returns boolean language sql as $$
  select exists (select 1 from public.role_permissions where role = p_role and permission = p_permission)
$$;

-- ===================== QUYỀN THEO NHÓM =====================
select ok(pg_temp.perm('BAN_GIAM_HIEU', 'news.publish'), 'Ban giám hiệu duyệt được tin');
select ok(pg_temp.perm('BAN_GIAM_HIEU', 'comments.manage'), 'Ban giám hiệu duyệt được bình luận');
select ok(not pg_temp.perm('BAN_GIAM_HIEU', 'users.manage'), 'Ban giám hiệu không quản lý tài khoản');
select ok(pg_temp.perm('TO_TRUONG', 'plans.manage') and pg_temp.perm('TO_TRUONG', 'documents.manage'), 'Tổ trưởng lập kế hoạch, đăng văn bản');
select ok(not pg_temp.perm('TO_TRUONG', 'news.publish'), 'Tổ trưởng không tự đăng tin');
select ok(pg_temp.perm('DOAN_THE', 'announcements.manage') and pg_temp.perm('DOAN_THE', 'media.manage'), 'Đoàn thể đăng thông báo, album');
select ok(pg_temp.perm('NHAN_VIEN', 'documents.manage') and pg_temp.perm('NHAN_VIEN', 'announcements.manage'), 'Nhân viên đăng văn bản, thông báo');
select ok(pg_temp.perm('GIAO_VIEN', 'news.create') and not pg_temp.perm('GIAO_VIEN', 'documents.manage'), 'Giáo viên chỉ viết tin');

-- ===================== TẠO TÀI KHOẢN =====================
select tests.as_user('admin@demo.local');
select throws_ok($$select public.create_staff_account('x@test.local', 'X', 'GIAO_VIEN')$$, '42501', null, 'Admin không tạo được tài khoản');
select tests.as_anon();
select throws_ok($$select public.create_staff_account('x@test.local', 'X', 'GIAO_VIEN')$$, '42501', null, 'Khách không gọi được');

select tests.as_user('superadmin@demo.local');
select set_config('tests.a', public.create_staff_account('GV.Moi@test.local', 'Giáo viên Mới', 'GIAO_VIEN')::text, true);
select set_config('tests.b', public.create_staff_account('gv2@test.local', 'Giáo viên Hai', 'GIAO_VIEN')::text, true);
select throws_ok($$select public.create_staff_account('gv.moi@test.local', 'Trùng', 'GIAO_VIEN')$$, '23505', null, 'Email trùng bị từ chối');
select throws_ok($$select public.create_staff_account('z@test.local', 'Z', 'KHONG_CO')$$, '22023', null, 'Vai trò lạ bị từ chối');

select tests.as_postgres();
select ok(current_setting('tests.a')::jsonb ->> 'password' <> current_setting('tests.b')::jsonb ->> 'password'
  and length(current_setting('tests.a')::jsonb ->> 'password') = 14, 'Mỗi tài khoản có mật khẩu ngẫu nhiên riêng');
select is(
  (select encrypted_password = extensions.crypt(current_setting('tests.a')::jsonb ->> 'password', encrypted_password)
   from auth.users where email = 'gv.moi@test.local'), true, 'Mật khẩu trả về khớp, CSDL chỉ lưu bản băm');
select results_eq(
  $$select role, must_change_password from public.profiles where email = 'gv.moi@test.local'$$,
  $$values ('GIAO_VIEN', true)$$, 'Đúng nhóm và buộc đổi mật khẩu');

-- ===================== ĐỔI, CẤP LẠI MẬT KHẨU =====================
update auth.users set encrypted_password = 'doi-moi' where email = 'gv.moi@test.local';
select is((select must_change_password from public.profiles where email = 'gv.moi@test.local'), false, 'Đổi mật khẩu xong thì hết bị buộc');

select tests.as_user('superadmin@demo.local');
select set_config('tests.c', public.reset_staff_password((select id from public.profiles where email = 'gv.moi@test.local'))::text, true);
select tests.as_postgres();
select is((select must_change_password from public.profiles where email = 'gv.moi@test.local'), true, 'Cấp lại mật khẩu thì lại buộc đổi');
select tests.as_user('superadmin@demo.local');
select throws_ok($$select public.reset_staff_password((select id from public.profiles where email = 'superadmin@demo.local'))$$,
  '42501', null, 'Không cấp lại mật khẩu cho quản trị cấp cao');
select tests.as_user('admin@demo.local');
select throws_ok($$select public.reset_staff_password((select id from public.profiles where email = 'gv2@test.local'))$$,
  '42501', null, 'Admin không cấp lại mật khẩu được');

select * from finish();
rollback;
