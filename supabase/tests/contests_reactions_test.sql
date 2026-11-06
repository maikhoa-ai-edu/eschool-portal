-- Cuộc thi, cảm xúc dưới bài, hạn bình chọn
begin;
select plan(22);

select tests.as_postgres();
insert into public.news_tags (id, name, slug) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Thi thử', 'thi-thu');
insert into public.news (id, title, slug, category_id, author_id, status, published_at, author_name, author_class, display_style)
select '00000000-0000-0000-0000-00000000c0b1', 'Bài dự thi 1', 'bai-du-thi-1', c.id, p.id, 'published', now() - interval '1 day',
  'Nguyễn Thị Hoa', '9A1', 'letter'
from public.news_categories c, public.profiles p where p.email = 'editor@demo.local' limit 1;
insert into public.news (id, title, slug, category_id, author_id, status)
select '00000000-0000-0000-0000-00000000c0b2', 'Bài nháp', 'bai-nhap-thi', c.id, p.id, 'draft'
from public.news_categories c, public.profiles p where p.email = 'editor@demo.local' limit 1;
insert into public.news_tag_map (news_id, tag_id) values
  ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-00000000c0a1'),
  ('00000000-0000-0000-0000-00000000c0b2', '00000000-0000-0000-0000-00000000c0a1');

-- ===================== CUỘC THI =====================
select tests.as_user('editor@demo.local');
select throws_ok($$insert into public.contests (title, tag_id) values ('x', '00000000-0000-0000-0000-00000000c0a1')$$,
  '42501', null, 'Biên tập viên không tạo được cuộc thi');
select tests.as_user('admin@demo.local');
select lives_ok($$insert into public.contests (id, title, tag_id, vote_ends_at)
  values ('00000000-0000-0000-0000-00000000c0c1', 'Cuộc thi thử', '00000000-0000-0000-0000-00000000c0a1', now() + interval '7 days')$$,
  'Admin tạo được cuộc thi');
select throws_ok($$insert into public.contests (title, tag_id) values ('Trùng', '00000000-0000-0000-0000-00000000c0a1')$$,
  '23505', null, 'Mỗi thẻ chỉ thuộc một cuộc thi');
select throws_ok($$insert into public.news (title, slug, category_id, author_id, display_style)
  select 'x', 'x-style', c.id, (select auth.uid()), 'fancy' from public.news_categories c limit 1$$,
  '23514', null, 'Kiểu trình bày chỉ nhận giá trị đã định');

-- ===================== CẢM XÚC =====================
select tests.as_anon();
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', gen_random_uuid(), 'like')$$, '42501', null, 'Khách không bấm được cảm xúc');
select is((select count(*)::int from public.contest_entries('00000000-0000-0000-0000-00000000c0c1')), 1,
  'Khách xem được bài dự thi đã đăng, không thấy bài nháp');

select tests.as_user('editor@demo.local');
select lives_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'love')$$, 'Người đăng nhập bấm được cảm xúc');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'like')$$, '23505', null, 'Mỗi tài khoản một lượt cho một bài');
select lives_ok($$update public.news_reactions set reaction = 'grateful'
  where news_id = '00000000-0000-0000-0000-00000000c0b1'$$, 'Đổi được loại cảm xúc');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b2', (select auth.uid()), 'like')$$, '42501', null, 'Bài chưa đăng không bấm được');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select id from public.profiles where email = 'admin@demo.local'), 'like')$$,
  '23505', null, 'Ghi user_id người khác vẫn bị tính là lượt của chính mình');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'haha')$$, '23514', null, 'Chỉ 4 loại cảm xúc');

select tests.as_user('admin@demo.local');
select lives_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'like')$$, 'Tài khoản khác bấm được');
select is((select count(*)::int from public.news_reactions where user_id <> (select auth.uid())), 0, 'Chỉ thấy cảm xúc của chính mình');

select tests.as_anon();
select is((select sum(total)::int from public.news_reaction_counts(array['00000000-0000-0000-0000-00000000c0b1'::uuid])), 2,
  'Khách xem được tổng số cảm xúc');
select is((select reactions from public.contest_entries('00000000-0000-0000-0000-00000000c0c1')),
  '{"like": 1, "grateful": 1}'::jsonb, 'Bảng xếp hạng đếm theo từng loại');

select tests.as_postgres();
update public.profiles set is_active = false where email = 'superadmin@demo.local';
select tests.as_user('superadmin@demo.local');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'like')$$, '42501', null, 'Tài khoản bị khóa không bấm được');
select tests.as_postgres();
update public.profiles set is_active = true where email = 'superadmin@demo.local';

-- ===================== HẠN BÌNH CHỌN =====================
update public.contests set vote_ends_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-00000000c0c1';
select tests.as_user('superadmin@demo.local');
select throws_ok($$insert into public.news_reactions (news_id, user_id, reaction)
  values ('00000000-0000-0000-0000-00000000c0b1', (select auth.uid()), 'like')$$, 'P0001', null, 'Hết hạn thì không bấm thêm được');
select tests.as_user('editor@demo.local');
select throws_ok($$delete from public.news_reactions where news_id = '00000000-0000-0000-0000-00000000c0b1'$$,
  'P0001', null, 'Hết hạn thì không bỏ được cảm xúc');
select throws_ok($$update public.news_reactions set reaction = 'like' where news_id = '00000000-0000-0000-0000-00000000c0b1'$$,
  'P0001', null, 'Hết hạn thì không đổi được cảm xúc');

-- ===================== SAO LƯU =====================
select tests.as_user('superadmin@demo.local');
select set_config('tests.backup', public.export_backup()::text, true);
select is((select count(*)::int from jsonb_array_elements(current_setting('tests.backup')::jsonb -> 'data' -> 'news_reactions') r
  where r ->> 'news_id' = '00000000-0000-0000-0000-00000000c0b1'), 2, 'Bản sao lưu có cảm xúc');
select lives_ok($$select public.restore_backup(current_setting('tests.backup')::jsonb)$$, 'Khôi phục được cuộc thi và cảm xúc');

select * from finish();
rollback;
