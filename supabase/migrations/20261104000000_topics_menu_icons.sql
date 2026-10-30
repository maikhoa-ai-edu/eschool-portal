-- eSchool Portal 0.8.0: icon cho menu, thanh menu đáy trên điện thoại, trang chuyên đề, banner trang chủ (Giai đoạn 8)

-- ---------------------------------------------------------------------------
-- Icon của mục menu (tên khóa trong danh sách icon của giao diện; null = icon mặc định)
-- ---------------------------------------------------------------------------

alter table public.menu_items
  add column icon text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$');

update public.menu_items
set icon = case url
  when '/' then 'home'
  when '/trang/gioi-thieu' then 'info'
  when '/tin-tuc' then 'newspaper'
  when '/thong-bao' then 'bell'
  when '/van-ban' then 'file-text'
  when '/thu-vien-anh' then 'images'
  when '/trang/lien-he' then 'phone'
end
where url in ('/', '/trang/gioi-thieu', '/tin-tuc', '/thong-bao', '/van-ban', '/thu-vien-anh', '/trang/lien-he');

-- ---------------------------------------------------------------------------
-- Thanh menu đáy trên điện thoại: một menu thường, sửa trong trang quản trị Menu
-- ---------------------------------------------------------------------------

alter table public.menus drop constraint menus_location_check;
alter table public.menus add constraint menus_location_check
  check (location in ('header', 'footer', 'quick_links', 'mobile_bar'));

-- Cũng gọi khi khôi phục bản sao lưu cũ (chưa có menu này)
create function private.ensure_mobile_menu()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_menu uuid;
begin
  insert into public.menus (code, name, location)
  values ('mobile', 'Thanh đáy điện thoại', 'mobile_bar')
  on conflict (code) do nothing
  returning id into v_menu;
  if v_menu is null then
    return;
  end if;
  insert into public.menu_items (menu_id, title, url, icon, sort_order) values
    (v_menu, 'Trang chủ', '/', 'home', 0),
    (v_menu, 'Tin tức', '/tin-tuc', 'newspaper', 1),
    (v_menu, 'Thông báo', '/thong-bao', 'bell', 2),
    (v_menu, 'Văn bản', '/van-ban', 'file-text', 3),
    (v_menu, 'Liên hệ', '/trang/lien-he', 'phone', 4);
end;
$$;

revoke execute on function private.ensure_mobile_menu() from public, anon, authenticated;

select private.ensure_mobile_menu();

-- ---------------------------------------------------------------------------
-- Trang chuyên đề: phần đầu trang + danh sách khối nội dung (giao diện kiểm tra cấu trúc khối khi đọc)
-- ---------------------------------------------------------------------------

insert into public.module_settings (module_key) values ('topics');

insert into public.role_permissions (role, permission) values
  ('SUPER_ADMIN', 'topics.manage'),
  ('ADMIN', 'topics.manage');

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  badge text,
  summary text,
  -- Đường dẫn trong bucket media (để sao lưu kèm ảnh)
  hero_image text,
  hero_color text check (hero_color is null or hero_color ~ '^#[0-9a-fA-F]{6}$'),
  quote_text text,
  quote_author text,
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order int not null default 0,
  meta_title text,
  meta_description text,
  no_index boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger topics_updated_at before update on public.topics
  for each row execute function private.set_updated_at();
create trigger topics_published_at before insert or update on public.topics
  for each row execute function private.set_published_at();
create trigger audit after insert or update or delete on public.topics
  for each row execute function private.audit_row();

alter table public.topics enable row level security;
create policy "Xem chuyên đề đã đăng" on public.topics
  for select to anon, authenticated using (status = 'published' or public.is_staff());
create policy "Quản lý chuyên đề" on public.topics
  for all to authenticated
  using (public.has_permission('topics.manage'))
  with check (public.has_permission('topics.manage'));

grant select on public.topics to anon;
grant select, insert, update, delete on public.topics to authenticated;

-- ---------------------------------------------------------------------------
-- Banner trang chủ: khối mới, tắt sẵn để trường đang chạy không đổi giao diện khi nâng cấp
-- ---------------------------------------------------------------------------

update public.site_settings
set value = jsonb_set(
  value, '{sections}',
  coalesce(value -> 'sections', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('key', 'topic_banner', 'enabled', false, 'title', '', 'limit', 0))
)
where key = 'homepage' and not coalesce(value -> 'sections', '[]'::jsonb) @> '[{"key": "topic_banner"}]';

-- ---------------------------------------------------------------------------
-- Sao lưu: thêm bảng topics; bản sao lưu cũ không có menu đáy thì tạo lại mặc định
-- ---------------------------------------------------------------------------

create or replace function private.backup_content_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'news_categories', 'news_tags', 'news', 'news_tag_map', 'announcements', 'documents', 'pages',
    'menus', 'menu_items', 'media', 'albums', 'album_items', 'homepage_slides', 'site_visits_daily', 'topics'
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

update public.app_meta set value = '0.8.0', updated_at = now() where key = 'schema_version';
