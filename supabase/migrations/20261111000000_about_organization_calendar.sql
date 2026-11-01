-- Tinh chỉnh sau Giai đoạn 8.6, schema 0.11.0: trang Giới thiệu dạng landing, Cơ cấu tổ chức, sự kiện quan trọng
-- trong kế hoạch, Sơ đồ trang. Trường đang chạy giữ nguyên giao diện: trang cũ vẫn ở bố cục cũ tới khi quản trị viên đổi.

-- ---------------------------------------------------------------------------
-- Trang: hai bố cục mới, nội dung theo từng mục của trang Giới thiệu
-- ---------------------------------------------------------------------------
alter table public.pages drop constraint pages_template_check;
alter table public.pages add constraint pages_template_check
  check (template in ('default', 'fullwidth', 'contact', 'about', 'organization'));
alter table public.pages add column landing jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Cơ cấu tổ chức: tách khỏi tài khoản đăng nhập, không có điện thoại, email, ngày sinh
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('SUPER_ADMIN', 'organization.manage'),
  ('ADMIN', 'organization.manage');

create table public.org_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.org_units (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  position text,
  start_year int check (start_year between 1950 and 2100),
  qualification text,
  subjects text,
  avatar_path text,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_members_unit_idx on public.org_members (unit_id, sort_order);

create trigger org_units_updated_at before update on public.org_units
  for each row execute function private.set_updated_at();
create trigger org_members_updated_at before update on public.org_members
  for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on public.org_units
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.org_members
  for each row execute function private.audit_row();

alter table public.org_units enable row level security;
create policy "Xem bộ phận" on public.org_units
  for select to anon, authenticated using (true);
create policy "Quản lý bộ phận" on public.org_units
  for all to authenticated
  using (public.has_permission('organization.manage'))
  with check (public.has_permission('organization.manage'));

alter table public.org_members enable row level security;
create policy "Xem thành viên đang hiện" on public.org_members
  for select to anon, authenticated using (is_visible or public.has_permission('organization.manage'));
create policy "Quản lý thành viên" on public.org_members
  for all to authenticated
  using (public.has_permission('organization.manage'))
  with check (public.has_permission('organization.manage'));

grant select on public.org_units, public.org_members to anon;
grant select, insert, update, delete on public.org_units, public.org_members to authenticated;

-- ---------------------------------------------------------------------------
-- Kế hoạch: đánh dấu sự kiện quan trọng để hiện trên lịch
-- ---------------------------------------------------------------------------
alter table public.work_plan_items
  add column is_important boolean not null default false,
  add column event_date date,
  add column event_end_date date,
  add constraint work_plan_items_event_date_check check (not is_important or event_date is not null),
  add constraint work_plan_items_event_range_check check (event_end_date is null or event_end_date >= event_date);

create index work_plan_items_event_idx on public.work_plan_items (event_date) where is_important;

-- ---------------------------------------------------------------------------
-- Icon Sơ đồ trang ở đầu trang: bản cài mới bật, trường đang chạy tắt
-- ---------------------------------------------------------------------------
update public.site_settings
set value = value || jsonb_build_object(
  'header_sitemap', not exists (select 1 from public.profiles where role = 'SUPER_ADMIN')
)
where key = 'site_chrome';

-- ---------------------------------------------------------------------------
-- Sao lưu: thêm hai bảng mới (bản sao lưu cũ không có bảng này thì bỏ qua)
-- ---------------------------------------------------------------------------
create or replace function private.backup_content_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'news_categories', 'news_tags', 'news', 'news_tag_map', 'content_groups', 'announcements', 'documents', 'pages',
    'menus', 'menu_items', 'media', 'albums', 'album_items', 'homepage_slides', 'site_visits_daily', 'topics',
    'videos', 'resources', 'work_plans', 'work_plan_items', 'news_comments', 'org_units', 'org_members'
  ]
$$;

create or replace function public.restore_backup(p_backup jsonb)
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
  delete from public.news_comments where true;
  delete from public.org_members where true;
  delete from public.org_units where true;
  delete from public.work_plan_items where true;
  delete from public.work_plans where true;
  delete from public.videos where true;
  delete from public.resources where true;
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
  delete from public.topics where true;
  delete from public.content_groups where true;

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
  perform private.ensure_mobile_menu();

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
