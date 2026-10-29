-- Hàm hỗ trợ kiểm thử: đóng vai một người dùng/khách trong giao dịch hiện tại.
-- Được tạo trong schema tests (chỉ tồn tại trên CSDL dev/CI).
create schema if not exists tests;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.as_user(p_email text)
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  execute 'reset role';
  select id into strict v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.as_postgres()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

begin;
select plan(1);
select has_function('tests', 'as_user', array['text'], 'helper as_user tồn tại');
select * from finish();
rollback;
