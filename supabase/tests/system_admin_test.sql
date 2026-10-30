-- Quản trị hệ thống: lời mời, đăng ký theo lời mời, khóa tài khoản, danh sách tài khoản, tình trạng hệ thống
begin;
select plan(24);

-- ===================== LỜI MỜI =====================
select tests.as_user('superadmin@demo.local');

select lives_ok(
  $$insert into public.invitations (email, role, invited_by)
    values (' GiaoVien.Moi@Demo.Local ', 'EDITOR', '00000000-0000-0000-0000-0000000000a1')$$,
  'Mời được giáo viên làm EDITOR');
select is((select role from public.invitations where email = 'giaovien.moi@demo.local'), 'EDITOR',
  'Email mời được chuẩn hóa chữ thường');
select throws_ok(
  $$insert into public.invitations (email, role, invited_by)
    values ('giaovien.moi@demo.local', 'ADMIN', '00000000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'Không mời trùng khi lời mời cũ còn mở');
select throws_ok(
  $$insert into public.invitations (email, role, invited_by)
    values ('editor@demo.local', 'ADMIN', '00000000-0000-0000-0000-0000000000a1')$$,
  '23505', 'Email này đã có tài khoản trong hệ thống', 'Không mời email đã có tài khoản');
select throws_ok(
  $$insert into public.invitations (email, role, invited_by)
    values ('mao.danh@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'Không ghi lời mời dưới tên người khác');

-- Gia hạn lời mời của người khác: phải nhận về mình (chính sách RLS)
select lives_ok(
  $$update public.invitations set expires_at = now() + interval '14 days',
      invited_by = '00000000-0000-0000-0000-0000000000a1'
    where email = 'thuky@demo.local'$$,
  'Gia hạn được lời mời đã hết hạn');
select lives_ok($$delete from public.invitations where email = 'thuky@demo.local'$$, 'Thu hồi được lời mời');
select is((select count(*)::int from public.invitations where email = 'thuky@demo.local'), 0, 'Lời mời đã bị xóa');

-- ===================== ĐĂNG KÝ =====================
select tests.as_postgres();
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated',
  'giaovien.moi@demo.local', '{"full_name":"Giáo viên mới"}');
select is((select role from public.profiles where email = 'giaovien.moi@demo.local'), 'EDITOR',
  'Đăng ký bằng email được mời thì nhận đúng vai trò');
select isnt((select accepted_at from public.invitations where email = 'giaovien.moi@demo.local'), null,
  'Lời mời được đánh dấu đã nhận');
select throws_ok(
  $$insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f2', 'authenticated',
      'authenticated', 'nguoi.la@demo.local')$$,
  '42501', null, 'Email chưa được mời không đăng ký được');

insert into public.invitations (email, role, expires_at) values ('het.han@demo.local', 'EDITOR', now() - interval '1 day');
select throws_ok(
  $$insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f3', 'authenticated',
      'authenticated', 'het.han@demo.local')$$,
  '42501', null, 'Lời mời hết hạn không đăng ký được');

select tests.as_user('giaovien.moi@demo.local');
select lives_ok(
  $$insert into public.news (title, slug, category_id, author_id, status)
    values ('Bài của giáo viên mới', 'bai-cua-giao-vien-moi', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f1', 'draft')$$,
  'Giáo viên mới soạn được bài');

-- ===================== KHÓA TÀI KHOẢN =====================
select tests.as_user('superadmin@demo.local');
select lives_ok($$update public.profiles set is_active = false where email = 'giaovien.moi@demo.local'$$,
  'Khóa được tài khoản');
select throws_ok($$update public.profiles set is_active = false where email = 'superadmin@demo.local'$$,
  '42501', null, 'Không tự khóa được mình');

select tests.as_user('giaovien.moi@demo.local');
select is(public.current_user_role(), null, 'Tài khoản bị khóa không còn vai trò');
select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id, status)
    values ('Bài sau khi khóa', 'bai-sau-khi-khoa', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f1', 'draft')$$,
  '42501', null, 'Tài khoản bị khóa không soạn được bài');

-- ===================== DANH SÁCH & TÌNH TRẠNG =====================
select tests.as_user('admin@demo.local');
select throws_ok('select * from public.list_accounts()', '42501', null, 'Admin không xem danh sách tài khoản');
select throws_ok('select public.get_system_health()', '42501', null, 'Admin không xem tình trạng chi tiết');

select tests.as_anon();
select throws_ok('select * from public.list_accounts()', '42501', null, 'Khách không gọi được list_accounts');
select throws_ok('select public.get_system_health()', '42501', null, 'Khách không gọi được get_system_health');

select tests.as_user('superadmin@demo.local');
select ok((select count(*) from public.list_accounts()) >= 3, 'Super admin xem danh sách tài khoản');
select is(public.get_system_health() -> 'tables_without_rls', '[]'::jsonb, 'Mọi bảng public đều bật RLS');
select is(
  (select jsonb_agg(b ->> 'id' order by b ->> 'id') from jsonb_array_elements(public.get_system_health() -> 'buckets') b),
  '["documents", "media"]'::jsonb, 'Có đủ hai bucket');

select * from finish();
rollback;
