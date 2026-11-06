-- Tác giả sửa bài đã đăng (về Chờ duyệt, trừ bài dự thi); trả lời và thích bình luận
begin;
select plan(20);

select tests.as_postgres();
insert into public.news (id, title, slug, content, category_id, author_id, status, published_at)
select '00000000-0000-0000-0000-00000000d0a1', 'Bài của giáo viên', 'bai-cua-giao-vien', 'Nội dung cũ', c.id, p.id,
  'published', now() - interval '1 day'
from public.news_categories c, public.profiles p where p.email = 'editor@demo.local' limit 1;
insert into public.news_comments (id, news_id, user_id, author_name, content, status)
select '00000000-0000-0000-0000-00000000d0c1', '00000000-0000-0000-0000-00000000d0a1', p.id, p.full_name, 'Đã duyệt', 'approved'
from public.profiles p where p.email = 'admin@demo.local';
insert into public.news_comments (id, news_id, user_id, author_name, content, status)
select '00000000-0000-0000-0000-00000000d0c2', '00000000-0000-0000-0000-00000000d0a1', p.id, p.full_name, 'Chờ duyệt', 'pending'
from public.profiles p where p.email = 'admin@demo.local';

-- ===================== TÁC GIẢ SỬA BÀI ĐÃ ĐĂNG =====================
select tests.as_user('editor@demo.local');
select ok(public.news_is_contest_entry('00000000-0000-0000-0000-0000000000f2'), 'Nhận ra bài dự thi');
select ok(not public.news_is_contest_entry('00000000-0000-0000-0000-00000000d0a1'), 'Bài thường không phải bài dự thi');
select throws_ok($$update public.news set content = 'Sửa nhưng vẫn đăng' where id = '00000000-0000-0000-0000-00000000d0a1'$$,
  '42501', null, 'Tác giả không giữ trạng thái Đã đăng khi sửa');
select lives_ok($$update public.news set content = 'Nội dung mới', status = 'pending' where id = '00000000-0000-0000-0000-00000000d0a1'$$,
  'Tác giả sửa bài đã đăng, bài về Chờ duyệt');
select tests.as_postgres();
select is((select status from public.news where id = '00000000-0000-0000-0000-00000000d0a1'), 'pending', 'Bài đã về Chờ duyệt');
select isnt((select published_at from public.news where id = '00000000-0000-0000-0000-00000000d0a1'), null, 'Giữ ngày đăng cũ');

select tests.as_user('editor@demo.local');
update public.news set content = 'Bị sửa', status = 'pending' where id = '00000000-0000-0000-0000-0000000000f2';
select tests.as_postgres();
select is((select status from public.news where id = '00000000-0000-0000-0000-0000000000f2'), 'published',
  'Bài dự thi đã đăng: tác giả không sửa được');

update public.news set status = 'published' where id = '00000000-0000-0000-0000-00000000d0a1';
select tests.as_user('giaovien.van@demo.local');
update public.news set content = 'Người khác sửa', status = 'pending' where id = '00000000-0000-0000-0000-00000000d0a1';
select tests.as_postgres();
select is((select content from public.news where id = '00000000-0000-0000-0000-00000000d0a1'), 'Nội dung mới',
  'Giáo viên khác không sửa được bài của người khác');

-- ===================== TRẢ LỜI BÌNH LUẬN =====================
select tests.as_user('editor@demo.local');
select lives_ok($$insert into public.news_comments (news_id, parent_id, content, author_name)
  values ('00000000-0000-0000-0000-00000000d0a1', '00000000-0000-0000-0000-00000000d0c1', 'Trả lời', '')$$,
  'Trả lời được bình luận đã duyệt');
select throws_ok($$insert into public.news_comments (news_id, parent_id, content, author_name)
  values ('00000000-0000-0000-0000-00000000d0a1', '00000000-0000-0000-0000-00000000d0c2', 'Trả lời', '')$$,
  '22023', null, 'Không trả lời bình luận đang chờ duyệt');
select throws_ok($$insert into public.news_comments (news_id, parent_id, content, author_name)
  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000d0c1', 'Sai bài', '')$$,
  '22023', null, 'Không trả lời bình luận của bài khác');
select tests.as_postgres();
update public.news_comments set status = 'approved' where parent_id = '00000000-0000-0000-0000-00000000d0c1';
select tests.as_user('editor@demo.local');
select throws_ok($$insert into public.news_comments (news_id, parent_id, content, author_name)
  select '00000000-0000-0000-0000-00000000d0a1', id, 'Cấp hai', '' from public.news_comments
  where parent_id = '00000000-0000-0000-0000-00000000d0c1'$$,
  '22023', null, 'Chỉ trả lời một cấp');
select is((select status from public.news_comments where parent_id = '00000000-0000-0000-0000-00000000d0c1'
  and user_id = (select auth.uid())), 'approved', 'Trả lời cũng phải qua duyệt (đã duyệt ở bước trên)');

-- ===================== THÍCH BÌNH LUẬN =====================
select tests.as_anon();
select throws_ok($$insert into public.news_comment_likes (comment_id, user_id)
  values ('00000000-0000-0000-0000-00000000d0c1', gen_random_uuid())$$, '42501', null, 'Khách không thích được bình luận');
select tests.as_user('editor@demo.local');
select lives_ok($$insert into public.news_comment_likes (comment_id, user_id)
  values ('00000000-0000-0000-0000-00000000d0c1', (select auth.uid()))$$, 'Người đăng nhập thích được bình luận');
select throws_ok($$insert into public.news_comment_likes (comment_id, user_id)
  values ('00000000-0000-0000-0000-00000000d0c1', (select auth.uid()))$$, '23505', null, 'Mỗi người một lượt thích');
select throws_ok($$insert into public.news_comment_likes (comment_id, user_id)
  values ('00000000-0000-0000-0000-00000000d0c2', (select auth.uid()))$$, '42501', null, 'Không thích bình luận chưa duyệt');
select tests.as_anon();
select is((select total::int from public.news_comment_like_counts('00000000-0000-0000-0000-00000000d0a1')
  where comment_id = '00000000-0000-0000-0000-00000000d0c1'), 1, 'Khách xem được số lượt thích');

-- ===================== SAO LƯU =====================
select tests.as_user('superadmin@demo.local');
select set_config('tests.backup', public.export_backup()::text, true);
select is(jsonb_array_length(current_setting('tests.backup')::jsonb -> 'data' -> 'news_comment_likes'), 1,
  'Bản sao lưu có lượt thích bình luận');
select lives_ok($$select public.restore_backup(current_setting('tests.backup')::jsonb)$$, 'Khôi phục được trả lời và lượt thích');

select * from finish();
rollback;
