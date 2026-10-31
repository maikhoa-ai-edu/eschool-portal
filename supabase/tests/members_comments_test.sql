begin;
select plan(19);

create function pg_temp.new_user(p_email text, p_provider text default 'email', p_token text default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, now(),
    jsonb_build_object('provider', p_provider), jsonb_build_object('full_name', 'HS Thử', 'invite_token', p_token), now(), now());
  return v_id;
end;
$$;

create function pg_temp.act_as(p_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ===================== Tự đăng ký =====================
select throws_ok($$select pg_temp.new_user('la1@test.local')$$, '42501', null, 'Tắt tự đăng ký: người lạ không tạo được tài khoản');
select throws_ok($$select pg_temp.new_user('la2@test.local', 'google')$$, '42501', null, 'Tắt tự đăng ký: Google chưa được mời cũng bị từ chối');

insert into public.invitations (email, role, invited_by)
select 'mg@test.local', 'EDITOR', id from public.profiles where email = 'superadmin@demo.local';
select lives_ok($$select pg_temp.new_user('mg@test.local', 'google')$$, 'Google đã xác minh email: lời mời không cần mã');
select is((select role from public.profiles where email = 'mg@test.local'), 'EDITOR', 'Google theo đúng vai trò được mời');
update public.profiles set full_name = 'NV Được Mời' where email = 'mg@test.local';

insert into public.invitations (email, role, invited_by)
select 'mm@test.local', 'EDITOR', id from public.profiles where email = 'superadmin@demo.local';
select throws_ok($$select pg_temp.new_user('mm@test.local')$$, '42501', null, 'Đăng ký email vẫn phải có đúng mã mời');

update public.site_settings set value = value || '{"allow_self_signup": true}' where key = 'auth_options';
select lives_ok($$select pg_temp.new_user('tv@test.local')$$, 'Bật tự đăng ký: tạo được tài khoản');
select is((select role from public.profiles where email = 'tv@test.local'), null, 'Tự đăng ký luôn là Thành viên, không có vai trò');

-- ===================== Khách không đọc được tên thành viên =====================
insert into public.news_comments (id, news_id, user_id, author_name, content, status)
select '00000000-0000-0000-0000-0000000000aa', n.id, null, 'Ẩn danh', 'Đang chờ', 'pending'
from public.news n where n.status = 'published' limit 1;

select is((select count(*)::int from public.news_comments where id = '00000000-0000-0000-0000-0000000000aa'), 1, 'Bình luận đã tạo');

-- ===================== Bình luận =====================
set local role anon;
select is((select count(*)::int from public.news_comments where id = '00000000-0000-0000-0000-0000000000aa'), 0, 'Khách không thấy bình luận chờ duyệt');
select throws_ok(
  $$insert into public.news_comments (news_id, content, author_name) select id, 'x', 'x' from public.news limit 1$$,
  '42501', null, 'Khách không gửi được bình luận');
select is((select count(*)::int from public.profiles where full_name = 'HS Thử'), 0, 'Khách không đọc được tên thành viên');
reset role;

select set_config('tests.draft', (select id::text from public.news where status <> 'published' limit 1), true);
select pg_temp.act_as((select id from public.profiles where email = 'tv@test.local'));
select lives_ok(
  $$insert into public.news_comments (news_id, content, author_name, user_id, status)
    select id, 'Bình luận thật', 'Tên giả', (select auth.uid()), 'approved' from public.news where status = 'published' limit 1$$,
  'Thành viên gửi được bình luận');
select results_eq(
  $$select author_name, status from public.news_comments where content = 'Bình luận thật'$$,
  $$values ('HS Thử', 'pending')$$,
  'CSDL đặt tên thật và trạng thái chờ duyệt, bỏ qua giá trị trình duyệt gửi');
select is_empty(
  $$update public.news_comments set status = 'approved' where content = 'Bình luận thật' returning id$$,
  'Thành viên không tự duyệt được');
select throws_ok(
  $$insert into public.news_comments (news_id, content, author_name, user_id)
    values (current_setting('tests.draft')::uuid, 'Vào bài nháp', 'x', (select auth.uid()))$$,
  '42501', null, 'Không bình luận vào bài chưa đăng');
select is(public.has_permission('comments.manage'), false, 'Thành viên không có quyền duyệt');
reset role;

select pg_temp.act_as((select id from public.profiles where email = 'admin@demo.local'));
select lives_ok($$update public.news_comments set status = 'approved' where content = 'Bình luận thật'$$, 'Quản trị duyệt được');
select throws_ok($$update public.news_comments set content = 'Sửa lời' where content = 'Bình luận thật'$$, '42501', null, 'Người duyệt không sửa được lời người khác');
reset role;
set local role anon;
select is((select count(*)::int from public.news_comments where content = 'Bình luận thật'), 1, 'Khách thấy bình luận đã duyệt');
reset role;

select * from finish();
rollback;
