-- Sao lưu & khôi phục: quyền, không lộ bí mật, khôi phục đúng dữ liệu, đổi id theo email, giữ nhật ký
begin;
select plan(21);

-- ===================== QUYỀN =====================
select tests.as_anon();
select throws_ok('select public.export_backup()', '42501', null, 'Khách không sao lưu được');
select throws_ok($$select public.restore_backup('{}')$$, '42501', null, 'Khách không khôi phục được');
select tests.as_user('admin@demo.local');
select throws_ok('select public.export_backup()', '42501', null, 'Admin không sao lưu được');
select throws_ok($$select public.restore_backup('{"schema_version":"0.1.0","data":{"profiles":[]}}')$$,
  '42501', null, 'Admin không khôi phục được');

-- ===================== XUẤT =====================
select tests.as_user('superadmin@demo.local');
select set_config('tests.backup', public.export_backup()::text, true);
select is(current_setting('tests.backup')::jsonb ->> 'schema_version', public.get_schema_version(),
  'Bản sao lưu ghi phiên bản schema');
select ok(jsonb_array_length(current_setting('tests.backup')::jsonb -> 'data' -> 'news') >= 2, 'Có dữ liệu tin tức');
select ok(not exists (
  select 1 from jsonb_array_elements(current_setting('tests.backup')::jsonb -> 'data' -> 'news') n where n ? 'search_vector'
), 'Không xuất cột sinh tự động');
select ok(not exists (
  select 1 from jsonb_array_elements(current_setting('tests.backup')::jsonb -> 'data' -> 'invitations') i where i ? 'token'
), 'Không xuất mã mời');
select ok(current_setting('tests.backup') !~ 'encrypted_password', 'Không xuất mật khẩu');
select ok(exists (select 1 from public.audit_logs where table_name = 'backup' and summary = 'Tải bản sao lưu'),
  'Việc tải bản sao lưu được ghi nhật ký');

-- ===================== KHÔI PHỤC =====================
select throws_ok($$select public.restore_backup('{"schema_version":"0.1.0"}')$$, '22023', null, 'Từ chối file sai định dạng');
select throws_ok($$select public.restore_backup('{"schema_version":"99.0.0","data":{"profiles":[]}}')$$,
  '22023', null, 'Từ chối bản sao lưu mới hơn CSDL');
select throws_ok(
  $$select public.restore_backup(jsonb_set(current_setting('tests.backup')::jsonb, '{data,news,0,category_id}',
      '"00000000-0000-0000-0000-00000000dead"'))$$,
  '23503', null, 'Dữ liệu lỗi thì báo lỗi');
select ok(exists (select 1 from public.news), 'Lỗi giữa chừng không làm mất dữ liệu');

-- Đổi dữ liệu rồi khôi phục. Người khôi phục ở "project mới" có id khác với id trong bản sao lưu.
select tests.as_postgres();
insert into public.news (title, slug, category_id, author_id)
  values ('Bài sau khi sao lưu', 'bai-sau-khi-sao-luu', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');
delete from auth.users where email = 'giaovien.van@demo.local';
select set_config('tests.backup', replace(current_setting('tests.backup'),
  '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000a222'), true);

select tests.as_user('superadmin@demo.local');
select lives_ok($$select public.restore_backup(current_setting('tests.backup')::jsonb)$$, 'Khôi phục thành công');
-- Hàm vừa chạy xóa claim trong giao dịch; khi chạy thật giao dịch đã kết thúc ở đây
select tests.as_user('superadmin@demo.local');
select is((select count(*)::int from public.news where slug = 'bai-sau-khi-sao-luu'), 0, 'Dữ liệu sau bản sao lưu bị thay thế');
select ok(exists (select 1 from public.news where author_id = '00000000-0000-0000-0000-0000000000a2'),
  'Tham chiếu tới người có cùng email được đổi về id đang có');
select is((select role from public.profiles where email = 'giaovien.van@demo.local'), 'EDITOR', 'Tài khoản bị thiếu được tạo lại');
select is(public.current_user_role(), 'SUPER_ADMIN', 'Người khôi phục vẫn giữ quyền');
select ok(exists (select 1 from public.audit_logs where table_name = 'backup' and summary like 'Khôi phục bản sao lưu%'),
  'Việc khôi phục được ghi nhật ký');

select tests.as_postgres();
select is((select encrypted_password from auth.users where email = 'giaovien.van@demo.local'), '',
  'Tài khoản tạo lại chưa có mật khẩu');

select * from finish();
rollback;
