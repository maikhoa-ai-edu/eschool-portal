-- Giai đoạn 8.6, schema 0.10.0 (đợt B): tác giả và nguồn bài viết, phân loại thông báo, thư mục văn bản,
-- lượt xem văn bản. Cột phải của trang Thông báo, Văn bản tắt với trường đang chạy, bật sẵn với bản cài mới.

alter table public.news
  add column author_name text,
  add column source_name text,
  add column source_url text check (source_url is null or source_url ~ '^https?://');

-- ---------------------------------------------------------------------------
-- Nhóm nội dung: phân loại thông báo và thư mục văn bản (hai cấp, do giao diện giới hạn)
-- ---------------------------------------------------------------------------

create table public.content_groups (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('announcement', 'document')),
  parent_id uuid references public.content_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index content_groups_scope_idx on public.content_groups (scope, sort_order);

alter table public.content_groups enable row level security;
create policy "Xem nhóm nội dung" on public.content_groups
  for select to anon, authenticated using (true);
create policy "Quản lý nhóm nội dung" on public.content_groups
  for all to authenticated
  using (public.has_permission(case scope when 'announcement' then 'announcements.manage' else 'documents.manage' end))
  with check (public.has_permission(case scope when 'announcement' then 'announcements.manage' else 'documents.manage' end));

grant select on public.content_groups to anon;
grant select, insert, update, delete on public.content_groups to authenticated;

alter table public.announcements
  add column group_id uuid references public.content_groups (id) on delete set null;
alter table public.documents
  add column folder_id uuid references public.content_groups (id) on delete set null,
  add column view_count int not null default 0 check (view_count >= 0);

create index announcements_group_idx on public.announcements (group_id);
create index documents_folder_idx on public.documents (folder_id);

create function public.increment_document_view(p_document_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.documents set view_count = view_count + 1
  where id = p_document_id and status = 'published'
$$;

revoke execute on function public.increment_document_view(uuid) from public;
grant execute on function public.increment_document_view(uuid) to anon, authenticated;

update public.site_settings
set value = value || jsonb_build_object(
  'content_sidebar', not exists (select 1 from public.profiles where role = 'SUPER_ADMIN')
)
where key = 'site_chrome';
