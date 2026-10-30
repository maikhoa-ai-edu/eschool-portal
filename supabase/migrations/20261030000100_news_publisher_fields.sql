-- eSchool Portal 0.3.0: module nội dung (Giai đoạn 4)
--
-- Siết quy trình tin tức: chỉ người có quyền news.publish được đặt "tin nổi bật" và ngày đăng.
-- Trước đây biên tập viên có thể tự đánh dấu nổi bật hoặc đặt sẵn published_at (lùi/hẹn ngày) cho bài
-- nháp; khi quản trị duyệt, coalesce giữ nguyên giá trị đó.
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
            or new.published_at is distinct from old.published_at
            or new.published_by is distinct from old.published_by) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật hoặc ngày đăng' using errcode = '42501';
    end if;
  else
    if new.status in ('published', 'archived') and not v_can_publish then
      raise exception 'Không có quyền xuất bản bài viết' using errcode = '42501';
    end if;
    if not v_can_publish and (new.is_featured or new.published_at is not null or new.published_by is not null) then
      raise exception 'Chỉ người duyệt bài được đặt tin nổi bật hoặc ngày đăng' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(auth.uid(), new.published_by);
  end if;

  return new;
end;
$$;

update public.app_meta set value = '0.3.0', updated_at = now() where key = 'schema_version';
