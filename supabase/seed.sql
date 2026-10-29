-- Dữ liệu demo CHỈ dùng khi phát triển trên máy (supabase db reset).
-- Không nằm trong install.sql phát hành cho các trường.
-- Tài khoản demo (mật khẩu: demo1234):
--   superadmin@demo.local (SUPER_ADMIN), admin@demo.local (ADMIN), editor@demo.local (EDITOR)

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-0000000000a1'::uuid, 'superadmin@demo.local', 'Quản trị hệ thống'),
      ('00000000-0000-0000-0000-0000000000a2'::uuid, 'admin@demo.local', 'Phó Hiệu trưởng'),
      ('00000000-0000-0000-0000-0000000000a3'::uuid, 'editor@demo.local', 'Giáo viên biên tập')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;
end $$;

-- Gán vai trò sau khi tạo đủ tài khoản (trigger chặn đăng ký khi đã có SUPER_ADMIN)
update public.profiles set role = 'SUPER_ADMIN' where email = 'superadmin@demo.local';
update public.profiles set role = 'ADMIN' where email = 'admin@demo.local';
update public.profiles set role = 'EDITOR' where email = 'editor@demo.local';

update private.install_state set install_code = null, bootstrapped_at = now(), completed_at = now();

update public.site_settings set value = value || jsonb_build_object(
  'school_name', 'Trường THCS & THPT Vĩnh Phong',
  'short_name', 'THCS & THPT Vĩnh Phong',
  'governing_body', 'Sở Giáo dục và Đào tạo An Giang',
  'slogan', 'Dạy tốt - Học tốt',
  'address', 'Xã Vĩnh Phong, tỉnh An Giang',
  'phone', '',
  'email', ''
) where key = 'school_identity';

update public.site_settings set value = jsonb_build_object(
  'enabled', true,
  'items', jsonb_build_array(
    'Chào mừng năm học mới 2026 - 2027',
    'Lịch kiểm tra giữa học kỳ I đã được cập nhật tại mục Thông báo'
  )
) where key = 'marquee';

insert into public.news_categories (id, name, slug, sort_order) values
  ('00000000-0000-0000-0000-0000000000c1', 'Tin nhà trường', 'tin-nha-truong', 0),
  ('00000000-0000-0000-0000-0000000000c2', 'Hoạt động Đoàn - Đội', 'hoat-dong-doan-doi', 1),
  ('00000000-0000-0000-0000-0000000000c3', 'Tuyển sinh', 'tuyen-sinh', 2),
  ('00000000-0000-0000-0000-0000000000c4', 'Chuyên môn', 'chuyen-mon', 3);

insert into public.news (title, slug, excerpt, content, category_id, author_id, status, is_featured, published_at) values
  ('Khai giảng năm học 2026 - 2027', 'khai-giang-nam-hoc-2026-2027',
   'Sáng 5/9, nhà trường long trọng tổ chức lễ khai giảng năm học mới.',
   '<h2>Không khí ngày hội</h2><p>Toàn thể giáo viên và học sinh tham dự lễ khai giảng.</p>',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', true, now() - interval '30 days'),
  ('Hội thi học sinh giỏi cấp trường', 'hoi-thi-hoc-sinh-gioi-cap-truong',
   'Kết quả hội thi học sinh giỏi các môn văn hóa cấp trường.',
   '<p>Hội thi diễn ra trong hai ngày với hơn 200 học sinh tham gia.</p>',
   '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a2', 'published', false, now() - interval '7 days'),
  ('Thông tin tuyển sinh lớp 6 và lớp 10', 'thong-tin-tuyen-sinh-lop-6-va-lop-10',
   'Kế hoạch tuyển sinh năm học mới.',
   '<p>Nội dung đang soạn.</p>',
   '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a3', 'pending', false, null);

insert into public.announcements (title, content, priority, is_pinned, status, created_by) values
  ('Lịch kiểm tra giữa học kỳ I', '<p>Học sinh xem lịch chi tiết tại bảng tin.</p>', 'important', true, 'published',
   '00000000-0000-0000-0000-0000000000a2'),
  ('Nghỉ học do mưa bão', '<p>Học sinh nghỉ học ngày mai, đi học lại khi có thông báo mới.</p>', 'urgent', false, 'draft',
   '00000000-0000-0000-0000-0000000000a2');

insert into public.pages (title, slug, content, status, created_by) values
  ('Giới thiệu', 'gioi-thieu', '<h2>Lịch sử hình thành</h2><p>Nội dung giới thiệu nhà trường.</p>', 'published',
   '00000000-0000-0000-0000-0000000000a1'),
  ('Liên hệ', 'lien-he', '<p>Xã Vĩnh Phong, tỉnh An Giang.</p>', 'published',
   '00000000-0000-0000-0000-0000000000a1');
