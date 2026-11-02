-- eSchool Portal 0.12.0: đưa bài viết lên slide trang chủ
--
-- Người có quyền duyệt tick "Hiển thị trên slide" khi soạn bài. Mặc định không tick nên trường đang chạy
-- giữ nguyên giao diện. Sao lưu cũ không có cột này vẫn khôi phục được: restore_rows bỏ qua cột thiếu.

alter table public.news add column show_on_slider boolean not null default false;

create index news_slider_idx on public.news (published_at desc)
  where show_on_slider and status = 'published';

-- create or replace giữ nguyên trigger và quyền đã cấp.
create or replace function private.news_workflow()
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
    if not v_can_publish
       and (new.is_featured is distinct from old.is_featured
            or new.show_on_slider is distinct from old.show_on_slider
            or new.published_at is distinct from old.published_at
            or new.published_by is distinct from old.published_by) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật, slide hoặc ngày đăng' using errcode = '42501';
    end if;
  else
    if new.status in ('published', 'archived') and not v_can_publish then
      raise exception 'Không có quyền xuất bản bài viết' using errcode = '42501';
    end if;
    if not v_can_publish
       and (new.is_featured or new.show_on_slider or new.published_at is not null or new.published_by is not null) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật, slide hoặc ngày đăng' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(auth.uid(), new.published_by);
  end if;

  return new;
end;
$$;
