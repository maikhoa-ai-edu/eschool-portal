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
      ('00000000-0000-0000-0000-0000000000a3'::uuid, 'editor@demo.local', 'Giáo viên biên tập'),
      ('00000000-0000-0000-0000-0000000000a4'::uuid, 'giaovien.van@demo.local', 'Lê Thị Hoa'),
      ('00000000-0000-0000-0000-0000000000a5'::uuid, 'giaovien.nghi@demo.local', 'Trần Minh Tuấn')
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
update public.profiles set role = 'EDITOR' where email = 'giaovien.van@demo.local';
-- Tài khoản đã khóa: giáo viên chuyển trường
update public.profiles set role = 'EDITOR', is_active = false where email = 'giaovien.nghi@demo.local';

update private.install_state set install_code = null, bootstrapped_at = now(), completed_at = now();

update public.site_settings set value = value || jsonb_build_object(
  'school_name', 'Trường THCS & THPT Vĩnh Phong',
  'short_name', 'THCS & THPT Vĩnh Phong',
  'governing_body', 'Sở Giáo dục và Đào tạo An Giang',
  'slogan', 'Dạy tốt - Học tốt',
  'address', 'Xã Vĩnh Phong, tỉnh An Giang',
  'phone', '',
  'email', '',
  'principal', 'Nguyễn Văn An'
) where key = 'school_identity';

-- Ảnh lấy từ supabase/seed-storage (npm run db:reset tự tải lên Storage cục bộ); lưu đường dẫn trong bucket media
update public.site_settings set value = value || jsonb_build_object(
  'logo_url', 'seed/logo.jpg',
  'banner_url', 'seed/slide-hoc-tap.jpg'
) where key = 'branding';

update public.site_settings set value = jsonb_build_object(
  'enabled', true,
  'include_latest_news', false,
  'items', jsonb_build_array(
    jsonb_build_object('text', 'Chào mừng năm học mới 2026 - 2027', 'url', null),
    jsonb_build_object('text', 'Lịch kiểm tra giữa học kỳ I đã được cập nhật tại mục Thông báo', 'url', '/thong-bao'),
    jsonb_build_object('text', 'Hội giảng chào mừng ngày Nhà giáo Việt Nam 20/11', 'url', null)
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
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', true, now() - interval '55 days'),
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

-- ---------------------------------------------------------------------------
-- Dữ liệu mẫu Giai đoạn 5: ảnh, văn bản, album, slide, trang chủ
-- File thật nằm ở supabase/seed-storage/<bucket>/seed/... (scripts/seed-storage.ts tải lên)
-- ---------------------------------------------------------------------------

update public.news set thumbnail_url = 'seed/album/khuon-vien.jpg' where slug = 'khai-giang-nam-hoc-2026-2027';
update public.news set thumbnail_url = 'seed/album/hoc-tap-2.jpg' where slug = 'hoi-thi-hoc-sinh-gioi-cap-truong';

insert into public.news (title, slug, excerpt, content, thumbnail_url, category_id, author_id, status, is_featured, published_at, published_by) values
  ('Câu lạc bộ STEM ra mắt mô hình tưới nước thông minh', 'clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh',
   'Nhóm học sinh lớp 9 và lớp 11 tự thiết kế hệ thống tưới cây tự động dùng cảm biến độ ẩm đất.',
   '<p>Sau hai tháng nghiên cứu, nhóm học sinh Câu lạc bộ STEM đã hoàn thiện mô hình <strong>hệ thống tưới nước thông minh</strong> cho vườn trường.</p><h2>Cách hoạt động</h2><ul><li>Cảm biến đo độ ẩm đất mỗi 10 phút.</li><li>Khi đất khô, bộ điều khiển tự bật máy bơm.</li><li>Số liệu hiển thị trên máy tính bảng để cả lớp theo dõi.</li></ul><blockquote>Chúng em muốn vườn rau của trường luôn xanh tốt cả khi nghỉ hè.</blockquote><p>Mô hình sẽ được giới thiệu tại ngày hội khoa học kỹ thuật cấp huyện.</p>',
   'seed/slide-stem.jpg', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a3', 'published', true, now() - interval '3 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Hội giảng chào mừng ngày Nhà giáo Việt Nam 20/11', 'hoi-giang-chao-mung-ngay-nha-giao-viet-nam',
   'Hơn 30 tiết dạy được đăng ký tham gia hội giảng, tập trung đổi mới phương pháp và ứng dụng công nghệ.',
   '<p>Hưởng ứng phong trào thi đua chào mừng ngày Nhà giáo Việt Nam, các tổ chuyên môn đã đăng ký hơn 30 tiết dạy tốt.</p><p>Nhiều tiết học sử dụng máy tính bảng, bảng tương tác và phiếu học tập điện tử, giúp học sinh chủ động hơn.</p>',
   'seed/album/hoc-tap-1.jpg', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a2', 'published', false, now() - interval '2 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Đoàn trường sinh hoạt chủ điểm "Học tập và làm theo lời Bác"', 'doan-truong-sinh-hoat-chu-diem-hoc-tap-va-lam-theo-loi-bac',
   'Buổi sinh hoạt dưới cờ đặc biệt với phần kể chuyện về Bác Hồ của các chi đoàn.',
   '<p>Sáng thứ Hai, Đoàn trường tổ chức buổi sinh hoạt chủ điểm với chủ đề <em>Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh</em>.</p><p>Các chi đoàn kể những câu chuyện về Bác và liên hệ với việc rèn luyện hằng ngày của đoàn viên.</p>',
   'seed/slide-bac-ho.jpg', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', 'published', true, now() - interval '10 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Học sinh hào hứng với tiết học tại thư viện mới', 'hoc-sinh-hao-hung-voi-tiet-hoc-tai-thu-vien-moi',
   'Thư viện được sắp xếp lại theo mô hình thư viện thân thiện, có góc đọc và khu tự học.',
   '<p>Thư viện nhà trường vừa được cải tạo với hơn 3.000 đầu sách, góc đọc thân thiện và khu tự học nhóm.</p><p>Mỗi lớp có một tiết đọc sách tại thư viện mỗi tháng.</p>',
   'seed/album/thu-vien.jpg', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', false, now() - interval '5 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Liên đội ra quân "Trường học xanh - sạch - đẹp"', 'lien-doi-ra-quan-truong-hoc-xanh-sach-dep',
   'Toàn thể đội viên tham gia dọn vệ sinh, trồng cây và chăm sóc bồn hoa trong sân trường.',
   '<p>Hơn 600 đội viên đã tham gia buổi ra quân, trồng mới 50 cây xanh và chăm sóc các bồn hoa quanh sân trường.</p>',
   'seed/album/san-truong.jpg', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a3', 'published', false, now() - interval '14 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Họp cha mẹ học sinh đầu năm học 2026 - 2027', 'hop-cha-me-hoc-sinh-dau-nam-hoc-2026-2027',
   'Nhà trường thông tin kế hoạch năm học và thống nhất các khoản thu theo quy định.',
   '<p>Các lớp đã tổ chức họp cha mẹ học sinh, thông tin kế hoạch năm học và bầu Ban đại diện cha mẹ học sinh.</p>',
   'seed/slide-hoc-tap.jpg', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', false, now() - interval '25 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Thông tin tuyển sinh lớp 6 năm học 2027 - 2028', 'thong-tin-tuyen-sinh-lop-6-nam-hoc-2027-2028',
   'Phụ huynh xem trước thời gian nhận hồ sơ và hồ sơ cần chuẩn bị.',
   '<p>Thời gian nhận hồ sơ dự kiến từ tháng 6/2027. Hồ sơ gồm: đơn đăng ký, bản sao giấy khai sinh, học bạ tiểu học.</p>',
   'seed/slide-chao-mung.jpg', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a2', 'published', false, now() - interval '20 days', '00000000-0000-0000-0000-0000000000a2');

insert into public.news_tags (name, slug) values
  ('STEM', 'stem'), ('Đoàn - Đội', 'doan-doi'), ('Nhà giáo Việt Nam', 'nha-giao-viet-nam');
insert into public.news_tag_map (news_id, tag_id)
select n.id, t.id from public.news n join public.news_tags t on (n.slug, t.slug) in (
  ('clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh', 'stem'),
  ('doan-truong-sinh-hoat-chu-diem-hoc-tap-va-lam-theo-loi-bac', 'doan-doi'),
  ('lien-doi-ra-quan-truong-hoc-xanh-sach-dep', 'doan-doi'),
  ('hoi-giang-chao-mung-ngay-nha-giao-viet-nam', 'nha-giao-viet-nam'));

insert into public.announcements (title, content, priority, is_pinned, status, published_at, expires_at, created_by) values
  ('Thu hồ sơ xét học bổng khuyến học', '<p>Học sinh có hoàn cảnh khó khăn, học tập tốt nộp hồ sơ cho giáo viên chủ nhiệm trước ngày 15/11.</p>',
   'important', false, 'published', now() - interval '2 days', now() + interval '20 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Lịch nghỉ ngày Nhà giáo Việt Nam 20/11', '<p>Học sinh nghỉ học ngày 20/11 để tham dự lễ kỷ niệm. Đi học lại bình thường ngày 21/11.</p>',
   'normal', false, 'published', now() - interval '1 day', null, '00000000-0000-0000-0000-0000000000a2'),
  ('Tiêm chủng cho học sinh khối 6', '<p>Trạm Y tế xã phối hợp tiêm chủng cho học sinh khối 6 vào sáng thứ Bảy. Phụ huynh ký phiếu đồng ý gửi giáo viên chủ nhiệm.</p>',
   'normal', false, 'published', now() - interval '6 days', null, '00000000-0000-0000-0000-0000000000a2');

insert into public.documents (title, document_number, document_type, issuing_authority, signer, issue_date, effective_date, excerpt,
  file_path, file_name, file_size, mime_type, status, is_featured, created_by) values
  ('Kế hoạch thực hiện nhiệm vụ năm học 2026 - 2027', '01/KH-THCSTHPTVP', 'ke_hoach', 'Trường THCS & THPT Vĩnh Phong', 'Nguyễn Văn An',
   '2026-09-05', '2026-09-05', 'Mục tiêu, nhiệm vụ, giải pháp và lịch thực hiện các hoạt động trọng tâm của năm học.',
   'seed/ke-hoach-nam-hoc-2026-2027.pdf', 'ke-hoach-nam-hoc-2026-2027.pdf', 109725, 'application/pdf', 'published', true,
   '00000000-0000-0000-0000-0000000000a2'),
  ('Quyết định thành lập các tổ chuyên môn năm học 2026 - 2027', '15/QĐ-THCSTHPTVP', 'quyet_dinh', 'Trường THCS & THPT Vĩnh Phong', 'Nguyễn Văn An',
   '2026-09-10', '2026-09-10', 'Thành lập 05 tổ chuyên môn và quy định nhiệm vụ của tổ trưởng.',
   'seed/quyet-dinh-thanh-lap-to-chuyen-mon.pdf', 'quyet-dinh-thanh-lap-to-chuyen-mon.pdf', 111395, 'application/pdf', 'published', false,
   '00000000-0000-0000-0000-0000000000a2'),
  ('Thông báo lịch kiểm tra giữa học kỳ I', '42/TB-THCSTHPTVP', 'thong_bao', 'Trường THCS & THPT Vĩnh Phong', 'Trần Thị Bình',
   '2026-10-20', '2026-10-20', 'Lịch kiểm tra các môn từ ngày 02/11 đến 04/11/2026.',
   'seed/thong-bao-lich-kiem-tra-giua-hoc-ky-1.pdf', 'thong-bao-lich-kiem-tra-giua-hoc-ky-1.pdf', 103726, 'application/pdf', 'published', false,
   '00000000-0000-0000-0000-0000000000a2'),
  ('Mẫu đơn xin nghỉ học', null, 'bieu_mau', 'Trường THCS & THPT Vĩnh Phong', null,
   null, null, 'Phụ huynh in, điền và gửi giáo viên chủ nhiệm khi học sinh cần nghỉ học.',
   'seed/mau-don-xin-nghi-hoc.pdf', 'mau-don-xin-nghi-hoc.pdf', 78489, 'application/pdf', 'published', false,
   '00000000-0000-0000-0000-0000000000a2');

insert into public.media (id, title, file_path, file_size, mime_type, width, height, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', 'Giờ học nhóm', 'seed/album/hoc-tap-1.jpg', 108221, 'image/jpeg', 960, 720, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e2', 'Cô và trò', 'seed/album/hoc-tap-2.jpg', 114181, 'image/jpeg', 960, 720, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e3', 'Câu lạc bộ STEM', 'seed/album/stem-1.jpg', 114574, 'image/jpeg', 960, 720, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e4', 'Mô hình tưới nước', 'seed/album/stem-2.jpg', 120709, 'image/jpeg', 960, 720, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e5', 'Khuôn viên', 'seed/album/khuon-vien.jpg', 162767, 'image/jpeg', 1280, 714, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e6', 'Thư viện', 'seed/album/thu-vien.jpg', 145922, 'image/jpeg', 1280, 714, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000e7', 'Sân trường', 'seed/album/san-truong.jpg', 197074, 'image/jpeg', 1280, 714, '00000000-0000-0000-0000-0000000000a2');

insert into public.albums (id, title, slug, description, event_date, cover_media_id, status, created_by) values
  ('00000000-0000-0000-0000-0000000000b1', 'Học tập và trải nghiệm sáng tạo', 'hoc-tap-va-trai-nghiem-sang-tao',
   'Giờ học nhóm, tiết dạy tốt và sản phẩm của Câu lạc bộ STEM.', '2026-10-15',
   '00000000-0000-0000-0000-0000000000e3', 'published', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b2', 'Khuôn viên và thư viện nhà trường', 'khuon-vien-va-thu-vien-nha-truong',
   'Một vòng quanh trường đầu năm học mới.', '2026-09-20',
   '00000000-0000-0000-0000-0000000000e5', 'published', '00000000-0000-0000-0000-0000000000a2');

insert into public.album_items (album_id, media_id, sort_order, caption) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e3', 0, 'Câu lạc bộ STEM giới thiệu sản phẩm'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e4', 1, 'Mô hình tưới nước thông minh'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', 2, 'Giờ học nhóm'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e2', 3, 'Cô và trò trong tiết dạy tốt'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000e5', 0, 'Khuôn viên nhà trường'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000e6', 1, 'Thư viện thân thiện'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000e7', 2, 'Sân trường giờ ra chơi');

insert into public.homepage_slides (title, subtitle, image_path, link_url, sort_order, created_by) values
  ('Chào mừng năm học mới 2026 - 2027', 'Dạy tốt - Học tốt', 'seed/slide-chao-mung.jpg', '/trang/gioi-thieu', 0,
   '00000000-0000-0000-0000-0000000000a2'),
  ('Lớp học thân thiện, học sinh tích cực', 'Đổi mới phương pháp dạy học theo Chương trình GDPT 2018',
   'seed/slide-hoc-tap.jpg', '/tin-tuc/chuyen-muc/chuyen-mon', 1, '00000000-0000-0000-0000-0000000000a2'),
  ('Câu lạc bộ STEM: khám phá và sáng tạo', 'Mô hình tưới nước thông minh của học sinh',
   'seed/slide-stem.jpg', '/tin-tuc/clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh', 2, '00000000-0000-0000-0000-0000000000a2'),
  ('Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh', null, 'seed/slide-bac-ho.jpg', null, 3,
   '00000000-0000-0000-0000-0000000000a2');

update public.site_settings set value = value || jsonb_build_object(
  'category_ids', jsonb_build_array('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4')
) where key = 'homepage';

update public.pages set content = '<h2>Lịch sử hình thành</h2><p>Trường được thành lập năm 1978, từ một trường cấp II nhỏ nay đã trở thành trường THCS &amp; THPT với hơn 1.200 học sinh và 80 cán bộ, giáo viên, nhân viên.</p><h2>Sứ mệnh</h2><p>Xây dựng môi trường học tập thân thiện, an toàn; giúp mỗi học sinh phát triển toàn diện phẩm chất và năng lực.</p><h2>Thành tích</h2><ul><li>Nhiều năm liền đạt danh hiệu Tập thể lao động xuất sắc.</li><li>Đạt chuẩn quốc gia mức độ 1.</li></ul>'
where slug = 'gioi-thieu';
update public.pages set template = 'contact',
  content = '<p>Phụ huynh, học sinh cần liên hệ vui lòng đến văn phòng nhà trường trong giờ hành chính (sáng 7h00 - 11h00, chiều 13h30 - 17h00, thứ Hai đến thứ Sáu).</p>'
where slug = 'lien-he';
insert into public.pages (title, slug, content, status, sort_order, created_by) values
  ('Cơ cấu tổ chức', 'co-cau-to-chuc',
   '<h2>Ban Giám hiệu</h2><ul><li>Hiệu trưởng: Nguyễn Văn An</li><li>Phó Hiệu trưởng: Trần Thị Bình</li></ul><h2>Các tổ chuyên môn</h2><ul><li>Tổ Toán - Tin</li><li>Tổ Ngữ văn - Ngoại ngữ</li><li>Tổ Khoa học tự nhiên</li><li>Tổ Khoa học xã hội</li><li>Tổ Giáo dục thể chất - Nghệ thuật</li></ul>',
   'published', 1, '00000000-0000-0000-0000-0000000000a1');

insert into public.menu_items (menu_id, parent_id, title, url, sort_order)
select m.id, p.id, 'Cơ cấu tổ chức', '/trang/co-cau-to-chuc', 0
from public.menus m join public.menu_items p on p.menu_id = m.id and p.url = '/trang/gioi-thieu'
where m.code = 'main';

insert into public.menu_items (menu_id, title, url, open_in_new_tab, sort_order)
select m.id, i.title, i.url, i.new_tab, i.sort_order
from public.menus m
cross join (values
  ('Tin tức', '/tin-tuc', false, 0),
  ('Văn bản', '/van-ban', false, 1),
  ('Thư viện ảnh', '/thu-vien-anh', false, 2),
  ('Bộ Giáo dục và Đào tạo', 'https://moet.gov.vn', true, 3)
) as i(title, url, new_tab, sort_order)
where m.code = 'footer';

-- ---------------------------------------------------------------------------
-- Dữ liệu mẫu Giai đoạn 8: icon menu, thanh đáy, chuyên đề "Học tập và làm theo Bác", banner trang chủ
-- Tin, tài liệu, phong trào dưới đây là nội dung minh họa, không phải thông tin đã xác thực của trường.
-- ---------------------------------------------------------------------------

insert into public.news_tags (name, slug) values ('Học tập và làm theo Bác', 'hoc-tap-va-lam-theo-bac');

insert into public.news (title, slug, excerpt, content, thumbnail_url, category_id, author_id, status, published_at, published_by) values
  ('Chi bộ triển khai kế hoạch học tập và làm theo Bác năm học 2026 - 2027', 'chi-bo-trien-khai-ke-hoach-hoc-tap-va-lam-theo-bac',
   'Kế hoạch gắn việc tu dưỡng, rèn luyện của mỗi cán bộ, giáo viên với nhiệm vụ chuyên môn cụ thể.',
   '<p>Chi bộ nhà trường đã quán triệt kế hoạch năm học, gắn việc học tập và làm theo Bác với nhiệm vụ chuyên môn của từng tổ.</p><ul><li>Mỗi giáo viên đăng ký một việc làm cụ thể ngay từ đầu năm.</li><li>Kết quả được rà soát trong sinh hoạt tổ chuyên môn hằng tháng.</li></ul>',
   'seed/album/hoc-tap-2.jpg', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', now() - interval '12 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Hội thi kể chuyện về Bác cấp trường', 'hoi-thi-ke-chuyen-ve-bac-cap-truong',
   'Các chi đoàn, chi đội tham gia với nhiều phần thi kể chuyện và liên hệ bản thân.',
   '<p>Hội thi là dịp để học sinh tìm hiểu về cuộc đời của Bác và rút ra bài học cho việc rèn luyện hằng ngày.</p><p>Nhiều phần thi được sân khấu hóa, thu hút đông đảo học sinh cổ vũ.</p>',
   'seed/album/stem-1.jpg', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', 'published', now() - interval '16 days', '00000000-0000-0000-0000-0000000000a2'),
  ('Ra mắt góc đọc "Tủ sách về Bác" tại thư viện', 'ra-mat-goc-doc-tu-sach-ve-bac-tai-thu-vien',
   'Không gian đọc và tìm hiểu tư liệu về cuộc đời, sự nghiệp của Chủ tịch Hồ Chí Minh dành cho thầy và trò.',
   '<p>Góc đọc được bố trí ngay trong thư viện, gồm sách tiểu sử, hồi ký và các tác phẩm viết về Bác.</p><p>Học sinh có thể mượn sách về nhà hoặc đọc tại chỗ trong giờ ra chơi.</p>',
   'seed/album/thu-vien.jpg', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published', now() - interval '18 days', '00000000-0000-0000-0000-0000000000a2');

insert into public.news_tag_map (news_id, tag_id)
select n.id, t.id from public.news n cross join public.news_tags t
where t.slug = 'hoc-tap-va-lam-theo-bac' and n.slug in (
  'doan-truong-sinh-hoat-chu-diem-hoc-tap-va-lam-theo-loi-bac',
  'chi-bo-trien-khai-ke-hoach-hoc-tap-va-lam-theo-bac',
  'hoi-thi-ke-chuyen-ve-bac-cap-truong',
  'ra-mat-goc-doc-tu-sach-ve-bac-tai-thu-vien');

insert into public.documents (id, title, document_number, document_type, issuing_authority, signer, issue_date, effective_date, excerpt,
  file_path, file_name, file_size, mime_type, status, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', 'Kế hoạch học tập và làm theo Bác năm học 2026 - 2027', '05/KH-THCSTHPTVP', 'ke_hoach',
   'Trường THCS & THPT Vĩnh Phong', 'Nguyễn Văn An', '2026-09-08', '2026-09-08',
   'Nội dung, hình thức và lịch thực hiện chuyên đề trong năm học.',
   'seed/ke-hoach-hoc-tap-lam-theo-bac.pdf', 'ke-hoach-hoc-tap-lam-theo-bac.pdf', 110219, 'application/pdf', 'published',
   '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000d2', 'Tài liệu sinh hoạt: 5 điều Bác Hồ dạy thiếu niên, nhi đồng', null, 'khac',
   'Trường THCS & THPT Vĩnh Phong', null, '2026-09-15', null,
   'Tài liệu dùng trong tiết sinh hoạt lớp, kèm gợi ý liên hệ với việc rèn luyện hằng ngày.',
   'seed/tai-lieu-5-dieu-bac-ho-day.pdf', 'tai-lieu-5-dieu-bac-ho-day.pdf', 79061, 'application/pdf', 'published',
   '00000000-0000-0000-0000-0000000000a2');

insert into public.topics (title, slug, badge, summary, hero_image, hero_color, quote_text, quote_author, status, meta_description, created_by, sections) values
  ('Học tập và làm theo Bác', 'hoc-tap-va-lam-theo-bac', 'Chuyên đề năm học 2026 - 2027',
   'Thầy và trò Trường THCS & THPT Vĩnh Phong thi đua dạy tốt, học tốt, rèn đức luyện tài; học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh bằng những việc làm cụ thể mỗi ngày.',
   'seed/slide-bac-ho.jpg', '#A80000',
   'Non sông Việt Nam có trở nên tươi đẹp hay không, dân tộc Việt Nam có bước tới đài vinh quang để sánh vai với các cường quốc năm châu được hay không, chính là nhờ một phần lớn ở công học tập của các em.',
   'Chủ tịch Hồ Chí Minh, Thư gửi các học sinh (1945)', 'published',
   'Chuyên đề học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh của Trường THCS & THPT Vĩnh Phong.',
   '00000000-0000-0000-0000-0000000000a2',
   jsonb_build_array(
     jsonb_build_object('id', 'gioi-thieu', 'type', 'rich_text', 'area', 'main', 'enabled', true, 'title', 'Giới thiệu chuyên đề',
       'html', '<p>Chuyên đề được triển khai trong toàn trường, gắn với nhiệm vụ của từng tập thể và cá nhân:</p><ul><li><strong>Cán bộ, giáo viên:</strong> nêu gương trong giảng dạy, hết lòng vì học sinh.</li><li><strong>Học sinh:</strong> thực hiện tốt 5 điều Bác Hồ dạy, chăm học, chăm làm.</li><li><strong>Đoàn - Đội:</strong> tổ chức sinh hoạt chủ điểm, phong trào người tốt việc tốt.</li></ul>'),
     jsonb_build_object('id', 'bai-viet', 'type', 'news', 'area', 'main', 'enabled', true, 'title', 'Bài viết chuyên đề',
       'tag_slug', 'hoc-tap-va-lam-theo-bac', 'limit', 6),
     jsonb_build_object('id', 'viec-lam', 'type', 'cards', 'area', 'main', 'enabled', true, 'title', 'Việc làm theo Bác',
       'items', jsonb_build_array(
         jsonb_build_object('image_path', 'seed/album/hoc-tap-1.jpg', 'title', 'Giờ học nhóm hiệu quả', 'text', 'Học sinh giúp nhau cùng tiến bộ trong từng tiết học.', 'url', null),
         jsonb_build_object('image_path', 'seed/album/san-truong.jpg', 'title', 'Trường học xanh - sạch - đẹp', 'text', 'Mỗi lớp chăm sóc một bồn hoa trong sân trường.', 'url', '/tin-tuc/lien-doi-ra-quan-truong-hoc-xanh-sach-dep'),
         jsonb_build_object('image_path', 'seed/album/stem-2.jpg', 'title', 'Sáng tạo vì cộng đồng', 'text', 'Câu lạc bộ STEM làm mô hình tưới nước cho vườn trường.', 'url', '/tin-tuc/clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh')
       )),
     jsonb_build_object('id', 'hinh-anh', 'type', 'album', 'area', 'main', 'enabled', true, 'title', 'Hình ảnh hoạt động',
       'album_slug', 'hoc-tap-va-trai-nghiem-sang-tao', 'limit', 4),
     jsonb_build_object('id', 'nam-dieu', 'type', 'list', 'area', 'side', 'enabled', true, 'title', '5 điều Bác Hồ dạy',
       'items', jsonb_build_array('Yêu Tổ quốc, yêu đồng bào', 'Học tập tốt, lao động tốt', 'Đoàn kết tốt, kỷ luật tốt', 'Giữ gìn vệ sinh thật tốt', 'Khiêm tốn, thật thà, dũng cảm')),
     jsonb_build_object('id', 'tai-lieu', 'type', 'documents', 'area', 'side', 'enabled', true, 'title', 'Tài liệu học tập',
       'document_ids', jsonb_build_array('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')),
     jsonb_build_object('id', 'trich-dan', 'type', 'quote', 'area', 'side', 'enabled', true, 'title', 'Lời Bác dạy',
       'text', 'Vì lợi ích mười năm thì phải trồng cây, vì lợi ích trăm năm thì phải trồng người.', 'author', 'Chủ tịch Hồ Chí Minh'),
     -- Tắt sẵn: dán liên kết YouTube rồi bật khối này
     jsonb_build_object('id', 'video', 'type', 'video', 'area', 'side', 'enabled', false, 'title', 'Phim tư liệu', 'url', '', 'caption', '')
   ));

insert into public.menu_items (menu_id, title, url, icon, sort_order)
select m.id, 'Chuyên đề', '/chuyen-de/hoc-tap-va-lam-theo-bac', 'star', 7
from public.menus m where m.code = 'main';
update public.menu_items set icon = 'users'
where title = 'Cơ cấu tổ chức';

update public.site_settings set value = jsonb_set(value, '{sections}', jsonb_build_array(
    jsonb_build_object('key', 'topic_banner', 'enabled', true, 'title', '', 'limit', 0),
    jsonb_build_object('key', 'featured_news', 'enabled', true, 'title', 'Tin nổi bật', 'limit', 5),
    jsonb_build_object('key', 'latest_news', 'enabled', true, 'title', 'Tin mới nhất', 'limit', 6),
    jsonb_build_object('key', 'category_news', 'enabled', true, 'title', '', 'limit', 4),
    jsonb_build_object('key', 'albums', 'enabled', true, 'title', 'Thư viện ảnh', 'limit', 4),
    jsonb_build_object('key', 'announcements', 'enabled', true, 'title', 'Thông báo', 'limit', 5),
    jsonb_build_object('key', 'documents', 'enabled', true, 'title', 'Văn bản mới', 'limit', 5),
    jsonb_build_object('key', 'visit_counter', 'enabled', true, 'title', 'Thống kê truy cập', 'limit', 0)
  )) || jsonb_build_object('banner', jsonb_build_object(
    'image_path', 'seed/slide-bac-ho.jpg', 'alt', '', 'badge', 'Chuyên đề đặc biệt',
    'title', 'Học tập và làm theo Bác',
    'subtitle', 'Thầy và trò rèn đức, luyện tài, làm theo Bác bằng những việc làm cụ thể mỗi ngày.',
    'link_url', '/chuyen-de/hoc-tap-va-lam-theo-bac', 'cta_label', 'Khám phá chuyên đề', 'color', '#A80000', 'placement', 'top'
  ))
where key = 'homepage';

-- ---------------------------------------------------------------------------
-- Dữ liệu mẫu Giai đoạn 6: lượt truy cập, lời mời, tài khoản, nhật ký
-- ---------------------------------------------------------------------------

-- 45 ngày gần nhất: ngày thường đông hơn cuối tuần, không có số ngẫu nhiên để lần nào reset cũng giống nhau
insert into public.site_visits_daily (day, visits)
select d::date,
  case when extract(isodow from d) >= 6 then 35 else 110 end + (extract(doy from d)::int * 37) % 60
from generate_series(
  (now() at time zone 'Asia/Ho_Chi_Minh')::date - 45,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  interval '1 day'
) as d;

update auth.users set last_sign_in_at = now() - interval '2 hours' where email = 'superadmin@demo.local';
update auth.users set last_sign_in_at = now() - interval '1 day' where email = 'admin@demo.local';
update auth.users set last_sign_in_at = now() - interval '3 days' where email = 'editor@demo.local';
update auth.users set last_sign_in_at = now() - interval '12 days' where email = 'giaovien.van@demo.local';
update auth.users set last_sign_in_at = now() - interval '90 days' where email = 'giaovien.nghi@demo.local';

insert into public.invitations (email, role, invited_by, created_at, expires_at, accepted_at) values
  ('editor@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a1', now() - interval '40 days', now() - interval '26 days', now() - interval '39 days'),
  ('giaovien.van@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a1', now() - interval '30 days', now() - interval '16 days', now() - interval '28 days'),
  ('giaovien.toan@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() + interval '12 days', null),
  ('totruong.khtn@demo.local', 'ADMIN', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now() + interval '13 days', null),
  ('thuky@demo.local', 'EDITOR', '00000000-0000-0000-0000-0000000000a1', now() - interval '20 days', now() - interval '6 days', null);

-- Dòng nhật ký do chính các lệnh seed tạo ra không có người thực hiện, thay bằng lịch sử dễ hình dung
delete from public.audit_logs where actor_id is null;

insert into public.audit_logs (occurred_at, actor_id, actor_role, action, table_name, record_id, changed_fields, summary)
select now() - e.ago, e.actor, p.role, e.action, e.table_name, e.record_id, e.fields, e.summary
from (values
  (interval '40 days', '00000000-0000-0000-0000-0000000000a1'::uuid, 'INSERT', 'invitations', null, null::text[], 'editor@demo.local'),
  (interval '30 days', '00000000-0000-0000-0000-0000000000a1', 'INSERT', 'invitations', null, null, 'giaovien.van@demo.local'),
  (interval '25 days', '00000000-0000-0000-0000-0000000000a2', 'INSERT', 'news', null, null, 'Họp cha mẹ học sinh đầu năm học 2026 - 2027'),
  (interval '21 days', '00000000-0000-0000-0000-0000000000a1', 'UPDATE', 'site_settings', 'branding', array['value'], 'branding'),
  (interval '20 days', '00000000-0000-0000-0000-0000000000a1', 'INSERT', 'invitations', null, null, 'thuky@demo.local'),
  (interval '15 days', '00000000-0000-0000-0000-0000000000a1', 'UPDATE', 'profiles', '00000000-0000-0000-0000-0000000000a5', array['is_active'], 'giaovien.nghi@demo.local'),
  (interval '14 days', '00000000-0000-0000-0000-0000000000a3', 'INSERT', 'news', null, null, 'Liên đội ra quân "Trường học xanh - sạch - đẹp"'),
  (interval '14 days' - interval '3 hours', '00000000-0000-0000-0000-0000000000a2', 'UPDATE', 'news', null, array['published_at', 'published_by', 'status'], 'Liên đội ra quân "Trường học xanh - sạch - đẹp"'),
  (interval '6 days', '00000000-0000-0000-0000-0000000000a2', 'INSERT', 'announcements', null, null, 'Tiêm chủng cho học sinh khối 6'),
  (interval '5 days', '00000000-0000-0000-0000-0000000000a1', 'UPDATE', 'module_settings', 'albums', array['is_enabled'], 'albums'),
  (interval '3 days', '00000000-0000-0000-0000-0000000000a3', 'INSERT', 'news', null, null, 'Câu lạc bộ STEM ra mắt mô hình tưới nước thông minh'),
  (interval '3 days' - interval '2 hours', '00000000-0000-0000-0000-0000000000a2', 'UPDATE', 'news', null, array['is_featured', 'published_at', 'published_by', 'status'], 'Câu lạc bộ STEM ra mắt mô hình tưới nước thông minh'),
  (interval '2 days', '00000000-0000-0000-0000-0000000000a1', 'INSERT', 'invitations', null, null, 'giaovien.toan@demo.local'),
  (interval '2 days', '00000000-0000-0000-0000-0000000000a2', 'INSERT', 'homepage_slides', null, null, 'Câu lạc bộ STEM: khám phá và sáng tạo'),
  (interval '1 day', '00000000-0000-0000-0000-0000000000a1', 'INSERT', 'invitations', null, null, 'totruong.khtn@demo.local'),
  (interval '20 hours', '00000000-0000-0000-0000-0000000000a2', 'INSERT', 'documents', null, null, 'Thông báo lịch kiểm tra giữa học kỳ I'),
  (interval '5 hours', '00000000-0000-0000-0000-0000000000a3', 'UPDATE', 'news', null, array['status'], 'Thông tin tuyển sinh lớp 6 và lớp 10'),
  (interval '2 hours', '00000000-0000-0000-0000-0000000000a1', 'UPDATE', 'site_settings', 'school_identity', array['value'], 'school_identity')
) as e(ago, actor, action, table_name, record_id, fields, summary)
join public.profiles p on p.id = e.actor;
