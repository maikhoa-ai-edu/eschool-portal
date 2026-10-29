-- eSchool Portal 0.2.1: sửa bootstrap_super_admin / complete_install khi gọi qua API
--
-- Supabase bật pg_safeupdate cho mọi yêu cầu qua PostgREST: UPDATE/DELETE không có WHERE bị từ chối
-- ("UPDATE requires a WHERE clause"), kể cả bên trong hàm security definer. install_state chỉ có
-- một dòng (id = true) nên thêm điều kiện đó. create or replace giữ nguyên quyền EXECUTE đã cấp.
-- QUY ƯỚC: mọi UPDATE/DELETE trong hàm phải có WHERE (kiểm thử pgTAP no_unqualified_writes).

create or replace function public.bootstrap_super_admin(p_install_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_state private.install_state;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập trước' using errcode = '42501';
  end if;

  select * into v_state from private.install_state where id for update;

  if exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'Hệ thống đã có Quản trị viên cấp cao' using errcode = '42501';
  end if;
  if v_state.install_code is null
     or upper(trim(coalesce(p_install_code, ''))) <> v_state.install_code then
    raise exception 'Mã cài đặt không đúng' using errcode = '42501';
  end if;

  -- Cờ chỉ sống trong giao dịch này, cho phép guard_profile_update bỏ qua đúng một lần
  perform set_config('eschool.bootstrapping', 'on', true);
  update public.profiles set role = 'SUPER_ADMIN', is_active = true where id = v_uid;
  if not found then
    raise exception 'Không tìm thấy hồ sơ người dùng' using errcode = 'P0002';
  end if;
  perform set_config('eschool.bootstrapping', 'off', true);

  update private.install_state set install_code = null, bootstrapped_at = now() where id;
end;
$$;

create or replace function public.complete_install()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'SUPER_ADMIN' then
    raise exception 'Chỉ Quản trị viên cấp cao được hoàn tất cài đặt' using errcode = '42501';
  end if;
  update private.install_state set completed_at = coalesce(completed_at, now()) where id;
end;
$$;

update public.app_meta set value = '0.2.1', updated_at = now() where key = 'schema_version';
