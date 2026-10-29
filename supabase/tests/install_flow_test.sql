-- Luồng cài đặt: tạo SUPER_ADMIN đầu tiên bằng mã cài đặt, rồi chỉ email được mời mới đăng ký được
begin;
select no_plan();

-- Giả lập CSDL vừa cài: chưa có SUPER_ADMIN, có mã cài đặt
update public.profiles set role = null where role = 'SUPER_ADMIN';
update private.install_state set install_code = 'TESTCODE1234', bootstrapped_at = null, completed_at = null;

select lives_ok(
  $$insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1',
            'authenticated', 'authenticated', 'hieutruong@truong.edu.vn')$$,
  'Chưa có admin: cho phép đăng ký tài khoản đầu tiên');
select is((select role from public.profiles where email = 'hieutruong@truong.edu.vn'), null,
  'Tài khoản mới chưa có vai trò');

select tests.as_user('hieutruong@truong.edu.vn');
select is((public.get_install_status() ->> 'has_super_admin')::boolean, false, 'Trạng thái: chưa có admin');
select throws_ok($$select public.bootstrap_super_admin('SAIMA0000000')$$, '42501', null, 'Sai mã cài đặt bị từ chối');
select lives_ok($$select public.bootstrap_super_admin('testcode1234')$$, 'Đúng mã (không phân biệt hoa thường) thành công');
select is(public.current_user_role(), 'SUPER_ADMIN', 'Người cài trở thành SUPER_ADMIN');
select throws_ok($$select public.bootstrap_super_admin('TESTCODE1234')$$, '42501', null, 'Không bootstrap được lần hai');
select lives_ok($$select public.complete_install()$$, 'Hoàn tất cài đặt');
select is((public.get_install_status() ->> 'completed')::boolean, true, 'Trạng thái: đã hoàn tất');

-- Sau khi có admin: chỉ email được mời mới đăng ký được
select tests.as_postgres();
select throws_ok(
  $$insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'nguoila@example.com')$$,
  '42501', null, 'Email chưa được mời không đăng ký được');

insert into public.invitations (email, role) values ('GiaoVien@Truong.edu.vn', 'EDITOR');
select lives_ok(
  $$insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'giaovien@truong.edu.vn')$$,
  'Email được mời (không phân biệt hoa thường) đăng ký được');
select is((select role from public.profiles where email = 'giaovien@truong.edu.vn'), 'EDITOR',
  'Vai trò được gán theo lời mời');
select isnt((select accepted_at from public.invitations where email = 'giaovien@truong.edu.vn'), null,
  'Lời mời được đánh dấu đã dùng');

-- Admin thường không mời được SUPER_ADMIN
select tests.as_user('admin@demo.local');
select throws_ok(
  $$insert into public.invitations (email, role, invited_by)
    values ('x@truong.edu.vn', 'SUPER_ADMIN', '00000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'Admin không có quyền tạo lời mời');

select * from finish();
rollback;
