-- eSchool Portal 0.7.0: sao lưu & khôi phục (Giai đoạn 7)
--
-- Bản sao lưu KHÔNG chứa mật khẩu và mã mời. Tài khoản khôi phục sang project mới chưa có mật khẩu: mỗi người dùng
-- "Quên mật khẩu" để đặt lại. Lời mời còn mở được cấp mã mới.
-- Khôi phục chạy trong một giao dịch: lỗi ở bất kỳ bước nào thì dữ liệu giữ nguyên.

-- Thứ tự chèn (bảng cha trước); xóa theo thứ tự ngược lại
create function private.backup_content_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'news_categories', 'news_tags', 'news', 'news_tag_map', 'announcements', 'documents', 'pages',
    'menus', 'menu_items', 'media', 'albums', 'album_items', 'homepage_slides', 'site_visits_daily'
  ]
$$;

-- Một bảng dưới dạng mảng JSON, bỏ cột sinh tự động (search_vector...) và các cột được chỉ định
create function private.backup_rows(p_table text, p_exclude text[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_exclude text[];
begin
  select p_exclude || coalesce(array_agg(a.attname::text), '{}') into v_exclude
  from pg_catalog.pg_attribute a
  where a.attrelid = ('public.' || quote_ident(p_table))::regclass
    and a.attnum > 0 and not a.attisdropped and a.attgenerated <> '';
  execute format('select coalesce(jsonb_agg(to_jsonb(x) - $1), ''[]''::jsonb) from public.%I x', p_table)
    into v_rows using v_exclude;
  return v_rows;
end;
$$;

create function public.export_backup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb := '{}'::jsonb;
  v_table text;
begin
  if not public.has_permission('backup.manage') then
    raise exception 'Không có quyền sao lưu' using errcode = '42501';
  end if;

  foreach v_table in array private.backup_content_tables() || array['site_settings', 'module_settings'] loop
    v_data := v_data || jsonb_build_object(v_table, private.backup_rows(v_table));
  end loop;
  v_data := v_data
    || jsonb_build_object('profiles', private.backup_rows('profiles'))
    || jsonb_build_object('invitations', private.backup_rows('invitations', array['token']))
    || jsonb_build_object('audit_logs', private.backup_rows('audit_logs', array['id']));

  -- Tải dữ liệu ra ngoài là thao tác nhạy cảm nên cũng được ghi nhật ký
  insert into public.audit_logs (actor_id, actor_role, action, table_name, summary)
  values (auth.uid(), public.current_user_role(), 'INSERT', 'backup', 'Tải bản sao lưu');

  return jsonb_build_object(
    'schema_version', public.get_schema_version(),
    'created_at', now(),
    'data', v_data,
    'files', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', o.bucket_id,
        'path', o.name,
        'size', coalesce((o.metadata ->> 'size')::bigint, 0),
        'mime_type', o.metadata ->> 'mimetype'
      ) order by o.bucket_id, o.name), '[]'::jsonb)
      from storage.objects o
      where o.bucket_id in ('media', 'documents') and o.name not like '%.emptyFolderPlaceholder'
    )
  );
end;
$$;

-- Chèn các dòng JSON vào bảng; chỉ dùng cột có trong bản sao lưu để cột mới (bản cũ chưa có) nhận giá trị mặc định
create function private.restore_rows(p_table text, p_rows jsonb, p_conflict text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_columns text[];
  v_list text;
  v_update text;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    return;
  end if;
  select array_agg(a.attname::text order by a.attnum) into v_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = ('public.' || quote_ident(p_table))::regclass
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attidentity <> 'a'
    and exists (select 1 from jsonb_array_elements(p_rows) r where r ? a.attname::text);

  select string_agg(quote_ident(c), ', ') into v_list from unnest(v_columns) as c;
  select string_agg(format('%1$I = excluded.%1$I', c), ', ') into v_update
  from unnest(v_columns) as c where c is distinct from p_conflict;

  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) %3$s',
    p_table, v_list,
    case when p_conflict is null then ''
      else format('on conflict (%I) do update set %s', p_conflict, v_update) end
  ) using p_rows;
end;
$$;

-- Hồ sơ trong bản sao lưu chưa có tài khoản đăng nhập ở đây: tạo tài khoản chưa có mật khẩu
create function private.restore_account(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_profile ->> 'id')::uuid;
  v_email text := p_profile ->> 'email';
begin
  if exists (select 1 from auth.users where id = v_id) then
    return;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, '', now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_profile ->> 'full_name'),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', null, now(), now());
end;
$$;

-- Trong lúc khôi phục, hồ sơ được chèn từ bản sao lưu nên trigger không kiểm tra lời mời
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
begin
  if current_setting('eschool.restoring', true) = 'on' then
    return new;
  end if;

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

create function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_current int[] := string_to_array(public.get_schema_version(), '.')::int[];
  v_text text;
  v_backup jsonb;
  v_data jsonb;
  v_profile jsonb;
  v_existing uuid;
  v_table text;
  v_tables text[] := private.backup_content_tables();
  v_audit_start bigint;
  v_counts jsonb := '{}'::jsonb;
begin
  if not public.has_permission('backup.manage') then
    raise exception 'Không có quyền khôi phục dữ liệu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_backup -> 'data') is distinct from 'object'
     or jsonb_typeof(p_backup -> 'data' -> 'profiles') is distinct from 'array' then
    raise exception 'File sao lưu không đúng định dạng' using errcode = '22023';
  end if;
  if string_to_array(p_backup ->> 'schema_version', '.')::int[] > v_current then
    raise exception 'Bản sao lưu được tạo từ phiên bản mới hơn (%). Hãy nâng cấp CSDL trước khi khôi phục.',
      p_backup ->> 'schema_version' using errcode = '22023';
  end if;

  -- Cùng email nhưng khác id (vd quản trị viên vừa tạo ở project mới): đổi mọi tham chiếu sang id đang có
  v_text := p_backup::text;
  for v_profile in select jsonb_array_elements(p_backup -> 'data' -> 'profiles') loop
    select id into v_existing from public.profiles where email = v_profile ->> 'email';
    if v_existing is not null and v_existing::text <> v_profile ->> 'id' then
      v_text := replace(v_text, v_profile ->> 'id', v_existing::text);
    end if;
  end loop;
  v_backup := v_text::jsonb;
  v_data := v_backup -> 'data';

  -- Từ đây chạy như kết nối tin cậy (đã kiểm tra quyền ở trên): dữ liệu chép nguyên trạng, không qua các guard.
  -- Cờ và claim chỉ sống trong giao dịch này.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('eschool.restoring', 'on', true);

  select coalesce(max(id), 0) into v_audit_start from public.audit_logs;

  delete from public.invitations where true;
  delete from public.album_items where true;
  delete from public.albums where true;
  delete from public.media where true;
  delete from public.news_tag_map where true;
  delete from public.news where true;
  delete from public.news_tags where true;
  delete from public.news_categories where true;
  delete from public.announcements where true;
  delete from public.documents where true;
  delete from public.pages where true;
  delete from public.menu_items where true;
  delete from public.menus where true;
  delete from public.homepage_slides where true;
  delete from public.site_visits_daily where true;

  for v_profile in select jsonb_array_elements(v_data -> 'profiles') loop
    perform private.restore_account(v_profile);
  end loop;
  perform private.restore_rows('profiles', v_data -> 'profiles', 'id');

  foreach v_table in array v_tables loop
    perform private.restore_rows(v_table, v_data -> v_table);
    v_counts := v_counts || jsonb_build_object(v_table, jsonb_array_length(coalesce(v_data -> v_table, '[]'::jsonb)));
  end loop;
  perform private.restore_rows('site_settings', v_data -> 'site_settings', 'key');
  perform private.restore_rows('module_settings', v_data -> 'module_settings', 'module_key');

  -- Lời mời còn mở của người nay đã có tài khoản thì bỏ; mã mới được sinh theo giá trị mặc định
  perform private.restore_rows('invitations', (
    select coalesce(jsonb_agg(i), '[]'::jsonb)
    from jsonb_array_elements(coalesce(v_data -> 'invitations', '[]'::jsonb)) i
    where i ->> 'accepted_at' is not null
       or not exists (select 1 from public.profiles p where p.email = i ->> 'email')
  ));

  -- Người khôi phục luôn giữ được quyền, kể cả khi bản sao lưu ghi khác
  update public.profiles set role = 'SUPER_ADMIN', is_active = true where id = v_caller;
  update private.install_state set completed_at = coalesce(completed_at, now()) where id;

  -- Nhật ký cũ không bị xóa (khôi phục không được dùng để xóa dấu vết). Bỏ các dòng do chính thao tác này
  -- sinh ra, gộp lịch sử trong bản sao lưu, rồi ghi một dòng cho việc khôi phục.
  delete from public.audit_logs where id > v_audit_start;
  insert into public.audit_logs (occurred_at, actor_id, actor_role, action, table_name, record_id, changed_fields, summary)
  select r.occurred_at, r.actor_id, r.actor_role, r.action, r.table_name, r.record_id, r.changed_fields, r.summary
  from jsonb_populate_recordset(null::public.audit_logs, coalesce(v_data -> 'audit_logs', '[]'::jsonb)) r
  where not exists (
    select 1 from public.audit_logs a
    where a.occurred_at = r.occurred_at and a.table_name = r.table_name and a.action = r.action
      and a.record_id is not distinct from r.record_id
  );
  insert into public.audit_logs (actor_id, actor_role, action, table_name, summary)
  values (v_caller, 'SUPER_ADMIN', 'UPDATE', 'backup',
    'Khôi phục bản sao lưu ngày ' || coalesce(left(p_backup ->> 'created_at', 10), '?'));

  return v_counts;
end;
$$;

revoke execute on function public.export_backup(), public.restore_backup(jsonb) from public, anon, authenticated;
grant execute on function public.export_backup(), public.restore_backup(jsonb) to authenticated;
revoke execute on function
  private.backup_content_tables(),
  private.backup_rows(text, text[]),
  private.restore_rows(text, jsonb, text),
  private.restore_account(jsonb)
from public, anon, authenticated;

update public.app_meta set value = '0.7.0', updated_at = now() where key = 'schema_version';
