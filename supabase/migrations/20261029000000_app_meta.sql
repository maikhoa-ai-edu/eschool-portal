-- eSchool Portal: thông tin phiên bản schema
-- Ứng dụng so sánh get_schema_version() với REQUIRED_SCHEMA_VERSION (src/lib/version.ts)
-- để biết khi nào cần chạy upgrade SQL.

create table public.app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_meta is 'Siêu dữ liệu cài đặt (schema_version, ...). Chỉ ghi qua migration.';

alter table public.app_meta enable row level security;
-- Không tạo policy: không ai đọc/ghi trực tiếp qua API, chỉ qua hàm bên dưới.

insert into public.app_meta (key, value) values ('schema_version', '0.1.0');

create function public.get_schema_version()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_meta where key = 'schema_version'
$$;

revoke all on function public.get_schema_version() from public;
grant execute on function public.get_schema_version() to anon, authenticated;
