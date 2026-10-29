-- eSchool Portal: nội dung
-- Tin tức (chuyên mục, thẻ, quy trình duyệt), thông báo, văn bản, trang tĩnh, menu.

-- ---------------------------------------------------------------------------
-- Tin tức
-- ---------------------------------------------------------------------------

create table public.news_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  parent_id uuid references public.news_categories (id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create table public.news_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text,
  content text not null default '',
  thumbnail_url text,
  category_id uuid not null references public.news_categories (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'archived')),
  is_featured boolean not null default false,
  view_count int not null default 0 check (view_count >= 0),
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', private.vi_unaccent(title)), 'A')
    || setweight(to_tsvector('simple', private.vi_unaccent(excerpt)), 'B')
    || setweight(to_tsvector('simple', private.vi_unaccent(regexp_replace(content, '<[^>]+>', ' ', 'g'))), 'C')
  ) stored
);

create index news_public_idx on public.news (published_at desc) where status = 'published';
create index news_category_idx on public.news (category_id);
create index news_author_idx on public.news (author_id);
create index news_search_idx on public.news using gin (search_vector);

create table public.news_tag_map (
  news_id uuid not null references public.news (id) on delete cascade,
  tag_id uuid not null references public.news_tags (id) on delete cascade,
  primary key (news_id, tag_id)
);

create index news_tag_map_tag_idx on public.news_tag_map (tag_id);

create trigger news_categories_updated_at before update on public.news_categories
  for each row execute function private.set_updated_at();
create trigger news_updated_at before update on public.news
  for each row execute function private.set_updated_at();

-- Quy trình: Nháp -> Chờ duyệt -> Đã đăng -> Lưu trữ. Chỉ người có news.publish được đăng/gỡ.
create function private.news_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_publish boolean := private.is_trusted_connection() or public.has_permission('news.publish');
begin
  if tg_op = 'UPDATE' then
    if new.author_id is distinct from old.author_id and not private.is_trusted_connection()
       and not public.has_permission('news.edit_any') then
      raise exception 'Không được đổi tác giả bài viết' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and (new.status in ('published', 'archived') or old.status in ('published', 'archived'))
       and not v_can_publish then
      raise exception 'Không có quyền xuất bản hoặc gỡ bài viết' using errcode = '42501';
    end if;
  elsif new.status in ('published', 'archived') and not v_can_publish then
    raise exception 'Không có quyền xuất bản bài viết' using errcode = '42501';
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(auth.uid(), new.published_by);
  end if;

  return new;
end;
$$;

create trigger news_workflow before insert or update on public.news
  for each row execute function private.news_workflow();

alter table public.news_categories enable row level security;
create policy "Xem chuyên mục" on public.news_categories
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý chuyên mục" on public.news_categories
  for all to authenticated
  using (public.has_permission('news.manage_taxonomy'))
  with check (public.has_permission('news.manage_taxonomy'));

alter table public.news_tags enable row level security;
create policy "Xem thẻ" on public.news_tags
  for select to anon, authenticated using (true);
create policy "Người soạn bài tạo thẻ" on public.news_tags
  for insert to authenticated with check (public.has_permission('news.create'));
create policy "Sửa thẻ" on public.news_tags
  for update to authenticated
  using (public.has_permission('news.manage_taxonomy'))
  with check (public.has_permission('news.manage_taxonomy'));
create policy "Xóa thẻ" on public.news_tags
  for delete to authenticated using (public.has_permission('news.manage_taxonomy'));

alter table public.news enable row level security;
create policy "Xem tin đã đăng" on public.news
  for select to anon using (status = 'published' and published_at <= now());
create policy "Nhân sự xem tin" on public.news
  for select to authenticated using (
    (status = 'published' and published_at <= now())
    or author_id = (select auth.uid())
    or public.has_permission('news.edit_any')
  );
create policy "Viết tin" on public.news
  for insert to authenticated
  with check (public.has_permission('news.create') and author_id = (select auth.uid()));
create policy "Sửa tin" on public.news
  for update to authenticated
  using (
    public.has_permission('news.edit_any')
    or (author_id = (select auth.uid()) and public.has_permission('news.edit_own') and status in ('draft', 'pending'))
  )
  with check (
    public.has_permission('news.edit_any')
    or (author_id = (select auth.uid()) and status in ('draft', 'pending'))
  );
create policy "Xóa tin" on public.news
  for delete to authenticated using (
    public.has_permission('news.delete')
    or (author_id = (select auth.uid()) and status = 'draft')
  );

alter table public.news_tag_map enable row level security;
-- Chính sách trên bảng news áp dụng trong truy vấn con, nên chỉ thấy thẻ của tin mình được xem
create policy "Xem thẻ của tin" on public.news_tag_map
  for select to anon, authenticated using (exists (select 1 from public.news n where n.id = news_id));
create policy "Gắn thẻ tin" on public.news_tag_map
  for all to authenticated
  using (exists (
    select 1 from public.news n where n.id = news_id
      and (public.has_permission('news.edit_any')
           or (n.author_id = (select auth.uid()) and n.status in ('draft', 'pending')))
  ))
  with check (exists (
    select 1 from public.news n where n.id = news_id
      and (public.has_permission('news.edit_any')
           or (n.author_id = (select auth.uid()) and n.status in ('draft', 'pending')))
  ));

-- Tìm kiếm không dấu (gõ "thi hoc sinh gioi" vẫn ra "Thi học sinh giỏi")
create function public.search_news(p_query text, p_limit int default 20, p_offset int default 0)
returns setof public.news
language sql
stable
set search_path = ''
as $$
  select n.*
  from public.news n
  where n.status = 'published'
    and n.published_at <= now()
    and n.search_vector @@ websearch_to_tsquery('simple', private.vi_unaccent(p_query))
  order by ts_rank(n.search_vector, websearch_to_tsquery('simple', private.vi_unaccent(p_query))) desc,
           n.published_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create function public.increment_news_view(p_news_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.news set view_count = view_count + 1
  where id = p_news_id and status = 'published' and published_at <= now()
$$;

-- ---------------------------------------------------------------------------
-- Thông báo điều hành
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  content text not null default '',
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  is_pinned boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at > published_at)
);

create index announcements_public_idx on public.announcements (is_pinned desc, published_at desc)
  where status = 'published';

create trigger announcements_updated_at before update on public.announcements
  for each row execute function private.set_updated_at();

create function private.set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger announcements_published_at before insert or update on public.announcements
  for each row execute function private.set_published_at();

alter table public.announcements enable row level security;
create policy "Xem thông báo còn hiệu lực" on public.announcements
  for select to anon, authenticated using (
    (status = 'published' and published_at <= now() and (expires_at is null or expires_at > now()))
    or public.is_staff()
  );
create policy "Quản lý thông báo" on public.announcements
  for all to authenticated
  using (public.has_permission('announcements.manage'))
  with check (public.has_permission('announcements.manage'));

-- ---------------------------------------------------------------------------
-- Văn bản & tài liệu
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  document_number text,
  document_type text not null check (document_type in
    ('ke_hoach', 'quyet_dinh', 'cong_van', 'huong_dan', 'thong_bao', 'bieu_mau', 'bao_cao', 'khac')),
  issuing_authority text,
  signer text,
  issue_date date,
  effective_date date,
  excerpt text,
  file_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null,
  download_count int not null default 0 check (download_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', private.vi_unaccent(
      coalesce(title, '') || ' ' || coalesce(document_number, '') || ' ' || coalesce(signer, '')
      || ' ' || coalesce(issuing_authority, '') || ' ' || coalesce(excerpt, '')))
  ) stored
);

create index documents_public_idx on public.documents (issue_date desc) where status = 'published';
create index documents_search_idx on public.documents using gin (search_vector);

create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();
create trigger documents_published_at before insert or update on public.documents
  for each row execute function private.set_published_at();

alter table public.documents enable row level security;
create policy "Xem văn bản đã ban hành" on public.documents
  for select to anon, authenticated using (status = 'published' or public.is_staff());
create policy "Quản lý văn bản" on public.documents
  for all to authenticated
  using (public.has_permission('documents.manage'))
  with check (public.has_permission('documents.manage'));

create function public.increment_document_download(p_document_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.documents set download_count = download_count + 1
  where id = p_document_id and status = 'published'
$$;

-- ---------------------------------------------------------------------------
-- Trang tĩnh
-- ---------------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  content text not null default '',
  excerpt text,
  featured_image_url text,
  parent_id uuid references public.pages (id) on delete set null,
  template text not null default 'default' check (template in ('default', 'fullwidth', 'contact')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order int not null default 0,
  meta_title text,
  meta_description text,
  no_index boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create trigger pages_updated_at before update on public.pages
  for each row execute function private.set_updated_at();
create trigger pages_published_at before insert or update on public.pages
  for each row execute function private.set_published_at();

alter table public.pages enable row level security;
create policy "Xem trang đã đăng" on public.pages
  for select to anon, authenticated using (status = 'published' or public.is_staff());
create policy "Quản lý trang" on public.pages
  for all to authenticated
  using (public.has_permission('pages.manage'))
  with check (public.has_permission('pages.manage'));

-- ---------------------------------------------------------------------------
-- Menu điều hướng
-- ---------------------------------------------------------------------------

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  location text not null default 'header' check (location in ('header', 'footer', 'quick_links')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  parent_id uuid references public.menu_items (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  url text not null check (url ~ '^(/|https?://)'),
  open_in_new_tab boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index menu_items_menu_idx on public.menu_items (menu_id, sort_order);

create trigger menus_updated_at before update on public.menus
  for each row execute function private.set_updated_at();
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function private.set_updated_at();

alter table public.menus enable row level security;
create policy "Xem menu" on public.menus
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý menu" on public.menus
  for all to authenticated
  using (public.has_permission('menus.manage'))
  with check (public.has_permission('menus.manage'));

alter table public.menu_items enable row level security;
create policy "Xem mục menu" on public.menu_items
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý mục menu" on public.menu_items
  for all to authenticated
  using (public.has_permission('menus.manage'))
  with check (public.has_permission('menus.manage'));

-- Menu mặc định (trình cài đặt / trang quản trị chỉnh sau)
insert into public.menus (code, name, location) values
  ('main', 'Menu chính', 'header'),
  ('footer', 'Liên kết nhanh', 'footer');

insert into public.menu_items (menu_id, title, url, sort_order)
select m.id, i.title, i.url, i.sort_order
from public.menus m
cross join (values
  ('Trang chủ', '/', 0),
  ('Giới thiệu', '/trang/gioi-thieu', 1),
  ('Tin tức', '/tin-tuc', 2),
  ('Thông báo', '/thong-bao', 3),
  ('Văn bản', '/van-ban', 4),
  ('Thư viện ảnh', '/thu-vien-anh', 5),
  ('Liên hệ', '/trang/lien-he', 6)
) as i(title, url, sort_order)
where m.code = 'main';

-- ---------------------------------------------------------------------------
-- Nhật ký & quyền gọi hàm
-- ---------------------------------------------------------------------------

create trigger audit after insert or update or delete on public.news_categories
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.news
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.announcements
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.documents
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.pages
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.menus
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.menu_items
  for each row execute function private.audit_row();

revoke execute on function
  public.search_news(text, int, int),
  public.increment_news_view(uuid),
  public.increment_document_download(uuid)
from public, anon, authenticated;
grant execute on function
  public.search_news(text, int, int),
  public.increment_news_view(uuid),
  public.increment_document_download(uuid)
to anon, authenticated;
