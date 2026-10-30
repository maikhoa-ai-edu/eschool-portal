-- eSchool Portal 0.6.0: mã bí mật cho lời mời
--
-- Trước đây chỉ cần biết email đang được mời là đăng ký thay được. Nay phải có cả mã trong liên kết mời
-- (Supabase Auth chuyển mã qua raw_user_meta_data). Chỉ người có users.manage đọc được mã (RLS bảng invitations).

alter table public.invitations add column token uuid not null default gen_random_uuid();
create unique index invitations_token_idx on public.invitations (token);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite
  from public.invitations
  where email = lower(new.email)
    and token::text = new.raw_user_meta_data ->> 'invite_token'
    and accepted_at is null
    and expires_at > now()
  for update;

  if v_invite.id is null
     and exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'Email % chưa được mời tham gia hệ thống', new.email using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_invite.role
  );

  if v_invite.id is not null then
    update public.invitations set accepted_at = now() where id = v_invite.id;
  end if;

  return new;
end;
$$;

update public.app_meta set value = '0.6.0', updated_at = now() where key = 'schema_version';
