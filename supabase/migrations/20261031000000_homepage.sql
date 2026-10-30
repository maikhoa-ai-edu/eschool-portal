-- eSchool Portal 0.4.0: trang chủ & cấu hình (Giai đoạn 5)
--
-- - Slide trang chủ (homepage_slides)
-- - Cấu hình bố cục trang chủ (site_settings.homepage); người có homepage.manage (ADMIN trở lên) được sửa
--   bố cục trang chủ và dòng chữ chạy, các khóa cấu hình khác vẫn chỉ SUPER_ADMIN (settings.manage)
-- - Bộ đếm truy cập: thêm hôm qua, tháng này và số khởi điểm (giữ số lượt của website cũ)

-- ---------------------------------------------------------------------------
-- Slide
-- ---------------------------------------------------------------------------

create table public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  subtitle text,
  -- Đường dẫn trong bucket media (vd seed/slide-1.jpg) hoặc địa chỉ http(s) đầy đủ
  image_path text not null check (length(trim(image_path)) > 0),
  link_url text check (link_url is null or link_url ~ '^(/|https?://)'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homepage_slides_order_idx on public.homepage_slides (sort_order) where is_active;

create trigger homepage_slides_updated_at before update on public.homepage_slides
  for each row execute function private.set_updated_at();
create trigger audit after insert or update or delete on public.homepage_slides
  for each row execute function private.audit_row();

alter table public.homepage_slides enable row level security;
create policy "Xem slide" on public.homepage_slides
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "Quản lý slide" on public.homepage_slides
  for all to authenticated
  using (public.has_permission('homepage.manage'))
  with check (public.has_permission('homepage.manage'));

-- Bảng mới phải tự cấp quyền (migration grants đã đóng quyền mặc định)
grant select on public.homepage_slides to anon;
grant select, insert, update, delete on public.homepage_slides to authenticated;

-- ---------------------------------------------------------------------------
-- Cấu hình trang chủ
-- ---------------------------------------------------------------------------

insert into public.site_settings (key, value) values
  ('homepage', jsonb_build_object(
    'show_slides', true,
    'slide_interval', 6,
    'sections', jsonb_build_array(
      jsonb_build_object('key', 'featured_news', 'enabled', true, 'title', 'Tin nổi bật', 'limit', 5),
      jsonb_build_object('key', 'latest_news', 'enabled', true, 'title', 'Tin mới nhất', 'limit', 6),
      jsonb_build_object('key', 'category_news', 'enabled', true, 'title', '', 'limit', 4),
      jsonb_build_object('key', 'albums', 'enabled', true, 'title', 'Thư viện ảnh', 'limit', 4),
      jsonb_build_object('key', 'announcements', 'enabled', true, 'title', 'Thông báo', 'limit', 5),
      jsonb_build_object('key', 'documents', 'enabled', true, 'title', 'Văn bản mới', 'limit', 5),
      jsonb_build_object('key', 'visit_counter', 'enabled', true, 'title', 'Thống kê truy cập', 'limit', 0)
    ),
    'category_ids', '[]'::jsonb,
    'visit_counter_offset', 0
  ))
on conflict (key) do nothing;

create policy "Quản lý trang chủ và dòng chữ chạy" on public.site_settings
  for update to authenticated
  using (key in ('homepage', 'marquee') and public.has_permission('homepage.manage'))
  with check (key in ('homepage', 'marquee') and public.has_permission('homepage.manage'));

-- ---------------------------------------------------------------------------
-- Bộ đếm truy cập
-- ---------------------------------------------------------------------------

create or replace function public.get_visit_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date as d),
  offset_setting as (
    select coalesce(floor((value ->> 'visit_counter_offset')::numeric)::bigint, 0) as n
    from public.site_settings
    where key = 'homepage' and jsonb_typeof(value -> 'visit_counter_offset') = 'number'
  )
  select jsonb_build_object(
    'total', coalesce(sum(v.visits), 0) + coalesce((select n from offset_setting), 0),
    'today', coalesce(sum(v.visits) filter (where v.day = t.d), 0),
    'yesterday', coalesce(sum(v.visits) filter (where v.day = t.d - 1), 0),
    'month', coalesce(sum(v.visits) filter (where date_trunc('month', v.day) = date_trunc('month', t.d)), 0)
  )
  from today t
  left join public.site_visits_daily v on true
  group by t.d
$$;

update public.app_meta set value = '0.4.0', updated_at = now() where key = 'schema_version';
