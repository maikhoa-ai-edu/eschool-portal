-- Quy trình tin tức: nháp -> chờ duyệt -> trả lại / đăng -> lưu trữ, và các trường chỉ người duyệt được đặt
begin;
select plan(13);

-- ===================== EDITOR soạn bài =====================
select tests.as_user('editor@demo.local');

select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id, is_featured)
    values ('Tự nổi bật', 'tu-noi-bat', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000a3', true)$$,
  '42501', null, 'Editor không tự đánh dấu tin nổi bật');
select throws_ok(
  $$insert into public.news (title, slug, category_id, author_id, published_at)
    values ('Lùi ngày', 'lui-ngay', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000a3', now() - interval '1 year')$$,
  '42501', null, 'Editor không tự đặt ngày đăng');
select lives_ok(
  $$insert into public.news (title, slug, category_id, author_id, status)
    values ('Bài quy trình', 'bai-quy-trinh', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000a3', 'pending')$$,
  'Editor gửi duyệt ngay khi tạo bài');
select throws_ok(
  $$update public.news set is_featured = true where slug = 'bai-quy-trinh'$$,
  '42501', null, 'Editor không đánh dấu nổi bật khi sửa bài');

-- ===================== ADMIN trả lại bài =====================
select tests.as_user('admin@demo.local');

select lives_ok(
  $$update public.news set status = 'draft', review_note = 'Bổ sung ảnh minh họa' where slug = 'bai-quy-trinh'$$,
  'Admin trả lại bài kèm góp ý');

-- ===================== EDITOR sửa và gửi lại =====================
select tests.as_user('editor@demo.local');

select is((select review_note from public.news where slug = 'bai-quy-trinh'), 'Bổ sung ảnh minh họa',
  'Editor đọc được góp ý');
select lives_ok(
  $$update public.news set content = '<p>Đã bổ sung</p>', review_note = null, status = 'pending'
    where slug = 'bai-quy-trinh'$$,
  'Editor sửa bài bị trả lại và gửi duyệt lại');

-- ===================== ADMIN đăng, đánh dấu nổi bật =====================
select tests.as_user('admin@demo.local');

select lives_ok(
  $$update public.news set status = 'published', is_featured = true where slug = 'bai-quy-trinh'$$,
  'Admin đăng và đánh dấu nổi bật');
select is((select published_by from public.news where slug = 'bai-quy-trinh'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, 'Ghi nhận người duyệt');

-- ===================== EDITOR sau khi bài đã đăng =====================
select tests.as_user('editor@demo.local');

update public.news set title = 'Sửa sau khi đăng' where slug = 'bai-quy-trinh';
select is((select title from public.news where slug = 'bai-quy-trinh'), 'Bài quy trình',
  'Editor không sửa được bài của mình khi đã đăng');
delete from public.news where slug = 'bai-quy-trinh';
select is((select count(*)::int from public.news where slug = 'bai-quy-trinh'), 1,
  'Editor không xóa được bài đã đăng');

-- ===================== ADMIN gỡ bài =====================
select tests.as_user('admin@demo.local');

select lives_ok($$update public.news set status = 'archived' where slug = 'bai-quy-trinh'$$, 'Admin gỡ bài (lưu trữ)');

select tests.as_anon();
select is((select count(*)::int from public.news where slug = 'bai-quy-trinh'), 0, 'Khách không thấy bài đã gỡ');

select * from finish();
rollback;
