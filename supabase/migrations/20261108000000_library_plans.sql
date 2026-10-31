-- Giai đoạn 8.6, schema 0.10.0 (đợt C): thư viện video, tài nguyên (link) và kế hoạch công tác theo tháng.

insert into public.module_settings (module_key) values ('videos'), ('resources'), ('plans');

insert into public.role_permissions (role, permission) values
  ('SUPER_ADMIN', 'plans.manage'),
  ('ADMIN', 'plans.manage');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  -- Chỉ nhúng YouTube và Google Drive; giao diện cũng kiểm tra lại trước khi tạo iframe
  url text not null check (url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|drive\.google\.com)/'),
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  url text not null check (url ~ '^https?://'),
  kind text not null default 'khac' check (kind in ('phan_mem', 'giao_an', 'bieu_mau', 'khac')),
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_plans (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  title text not null check (length(trim(title)) > 0),
  note text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- File PDF đính kèm, nằm trong bucket documents (thư mục plans/)
  file_path text,
  file_name text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table public.work_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.work_plans (id) on delete cascade,
  sort_order int not null default 0,
  time_text text not null default '',
  content text not null check (length(trim(content)) > 0),
  assignee text not null default ''
);

create index work_plan_items_plan_idx on public.work_plan_items (plan_id, sort_order);

create trigger videos_updated_at before update on public.videos
  for each row execute function private.set_updated_at();
create trigger resources_updated_at before update on public.resources
  for each row execute function private.set_updated_at();
create trigger work_plans_updated_at before update on public.work_plans
  for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on public.videos
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.resources
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.work_plans
  for each row execute function private.audit_row();

alter table public.videos enable row level security;
create policy "Xem video đang hiện" on public.videos
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý video" on public.videos
  for all to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));

alter table public.resources enable row level security;
create policy "Xem tài nguyên đang hiện" on public.resources
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý tài nguyên" on public.resources
  for all to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));

alter table public.work_plans enable row level security;
create policy "Xem kế hoạch đã đăng" on public.work_plans
  for select to anon, authenticated using (status = 'published' or public.is_staff());
create policy "Quản lý kế hoạch" on public.work_plans
  for all to authenticated
  using (public.has_permission('plans.manage'))
  with check (public.has_permission('plans.manage'));

alter table public.work_plan_items enable row level security;
create policy "Xem dòng kế hoạch" on public.work_plan_items
  for select to anon, authenticated using (
    public.is_staff()
    or exists (select 1 from public.work_plans p where p.id = plan_id and p.status = 'published')
  );
create policy "Quản lý dòng kế hoạch" on public.work_plan_items
  for all to authenticated
  using (public.has_permission('plans.manage'))
  with check (public.has_permission('plans.manage'));

grant select on public.videos, public.resources, public.work_plans, public.work_plan_items to anon;
grant select, insert, update, delete
  on public.videos, public.resources, public.work_plans, public.work_plan_items to authenticated;
