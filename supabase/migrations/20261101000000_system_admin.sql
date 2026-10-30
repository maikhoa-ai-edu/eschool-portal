-- eSchool Portal 0.5.0: quản trị hệ thống (Giai đoạn 6)
--
-- - Từ chối lời mời gửi tới email đã có tài khoản (lời mời đó không bao giờ được dùng tới)
-- - list_accounts: danh sách tài khoản kèm lần đăng nhập cuối (nằm trong auth.users, API không đọc trực tiếp được)
-- - get_system_health: số liệu cho trang kiểm tra hệ thống
-- - Chỉ mục lọc nhật ký theo bảng

create index audit_logs_table_idx on public.audit_logs (table_name, occurred_at desc);

create or replace function private.guard_invitation_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  if new.role = 'SUPER_ADMIN' and not private.is_trusted_connection()
     and public.current_user_role() is distinct from 'SUPER_ADMIN' then
    raise exception 'Chỉ Quản trị viên cấp cao được mời SUPER_ADMIN' using errcode = '42501';
  end if;
  -- Lúc đăng ký, handle_new_user đánh dấu đã nhận sau khi tạo hồ sơ: lần cập nhật đó không đổi email nên không vào đây
  if new.accepted_at is null and (tg_op = 'INSERT' or new.email is distinct from old.email)
     and exists (select 1 from public.profiles where email = new.email) then
    raise exception 'Email này đã có tài khoản trong hệ thống' using errcode = '23505';
  end if;
  return new;
end;
$$;

create function public.list_accounts()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'Không có quyền xem danh sách tài khoản' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role, p.is_active, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.is_active desc, p.full_name;
end;
$$;

create function public.get_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('audit.view') then
    raise exception 'Không có quyền xem tình trạng hệ thống' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'database_size', pg_database_size(current_database()),
    'install_completed', (select completed_at is not null from private.install_state),
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'public', b.public,
        'file_count', (select count(*) from storage.objects o where o.bucket_id = b.id),
        'total_size', (
          select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
          from storage.objects o where o.bucket_id = b.id
        )
      ) order by b.id), '[]'::jsonb)
      from storage.buckets b
    ),
    -- Bảng public chưa bật RLS là lỗ hổng: khóa anon nằm công khai trong trình duyệt
    'tables_without_rls', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ),
    'accounts', (
      select jsonb_build_object(
        'active', count(*) filter (where is_active),
        'locked', count(*) filter (where not is_active),
        'super_admins', count(*) filter (where is_active and role = 'SUPER_ADMIN')
      )
      from public.profiles
    ),
    'invitations', (
      select jsonb_build_object(
        'open', count(*) filter (where accepted_at is null and expires_at > now()),
        'expired', count(*) filter (where accepted_at is null and expires_at <= now())
      )
      from public.invitations
    ),
    'modules', (
      select jsonb_build_object(
        'enabled', count(*) filter (where is_enabled),
        'total', count(*)
      )
      from public.module_settings
    ),
    'audit', (
      select jsonb_build_object('total', count(*), 'last_at', max(occurred_at))
      from public.audit_logs
    )
  );
end;
$$;

revoke execute on function public.list_accounts(), public.get_system_health() from public, anon, authenticated;
grant execute on function public.list_accounts(), public.get_system_health() to authenticated;

update public.app_meta set value = '0.5.0', updated_at = now() where key = 'schema_version';
