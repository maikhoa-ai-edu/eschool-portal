begin;
select plan(3);

select is(public.get_schema_version(), '0.1.0', 'get_schema_version trả về phiên bản đã seed');

set local role anon;
select is(public.get_schema_version(), '0.1.0', 'anon gọi được get_schema_version');
select throws_ok(
  'select * from public.app_meta',
  '42501',
  null,
  'anon không đọc trực tiếp được bảng app_meta'
);

select * from finish();
rollback;
