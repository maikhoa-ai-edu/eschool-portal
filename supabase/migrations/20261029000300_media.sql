-- eSchool Portal: thư viện media, album ảnh, kho lưu trữ file (Storage)

create table public.media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  file_path text not null unique,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  alt_text text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index media_created_idx on public.media (created_at desc);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  event_date date,
  cover_media_id uuid references public.media (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.album_items (
  album_id uuid not null references public.albums (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  sort_order int not null default 0,
  caption text,
  primary key (album_id, media_id)
);

create index album_items_media_idx on public.album_items (media_id);

create trigger albums_updated_at before update on public.albums
  for each row execute function private.set_updated_at();
create trigger albums_published_at before insert or update on public.albums
  for each row execute function private.set_published_at();

alter table public.media enable row level security;
create policy "Khách xem ảnh thuộc album đã đăng" on public.media
  for select to anon using (exists (
    select 1 from public.album_items ai join public.albums a on a.id = ai.album_id
    where ai.media_id = media.id and a.status = 'published'
  ));
create policy "Nhân sự xem thư viện" on public.media
  for select to authenticated using (public.is_staff());
create policy "Tải media lên" on public.media
  for insert to authenticated
  with check (public.has_permission('media.upload') and created_by = (select auth.uid()));
create policy "Sửa media" on public.media
  for update to authenticated
  using (public.has_permission('media.manage') or created_by = (select auth.uid()))
  with check (public.has_permission('media.manage') or created_by = (select auth.uid()));
create policy "Xóa media" on public.media
  for delete to authenticated
  using (public.has_permission('media.manage') or created_by = (select auth.uid()));

alter table public.albums enable row level security;
create policy "Xem album" on public.albums
  for select to anon, authenticated using (status = 'published' or public.is_staff());
create policy "Quản lý album" on public.albums
  for all to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));

alter table public.album_items enable row level security;
create policy "Xem ảnh trong album" on public.album_items
  for select to anon, authenticated using (exists (select 1 from public.albums a where a.id = album_id));
create policy "Quản lý ảnh trong album" on public.album_items
  for all to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));

create trigger audit after insert or update or delete on public.media
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.albums
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Storage: bucket công khai (đường dẫn chứa UUID nên không đoán được)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('documents', 'documents', true, 25 * 1024 * 1024,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ])
on conflict (id) do nothing;

create policy "Nhân sự liệt kê file" on storage.objects
  for select to authenticated
  using (bucket_id in ('media', 'documents') and public.is_staff());

create policy "Tải ảnh lên" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.has_permission('media.upload'));
create policy "Sửa/xóa ảnh" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (public.has_permission('media.manage') or owner_id = (select auth.uid())::text));
create policy "Xóa ảnh" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (public.has_permission('media.manage') or owner_id = (select auth.uid())::text));

create policy "Tải văn bản lên" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.has_permission('documents.manage'));
create policy "Sửa văn bản" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.has_permission('documents.manage'));
create policy "Xóa văn bản" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.has_permission('documents.manage'));
