# Lộ trình eSchool Portal

Xây lại từ `school-news-platform` (bản demo trường THCS & THPT Vĩnh Phong) thành sản phẩm cài đặt được cho nhiều trường.

## Quyết định kiến trúc

1. Frontend tĩnh (Vite + React) + mỗi trường một project Supabase riêng.
2. Không còn chế độ lưu dữ liệu trong localStorage, không có tài khoản quản trị viết cứng.
3. Một bản build chung; thông tin kết nối đọc từ `/config.json` lúc chạy.
4. Phân quyền thật nằm ở RLS trong CSDL; giao diện chỉ ẩn/hiện chức năng.
5. Nhật ký kiểm toán ghi bằng trigger CSDL.
6. Tài khoản mới qua lời mời (email + vai trò), trigger tự gán vai trò.
7. Repo công khai; giữ ghi công "Thiết kế bởi MVK" ở chân trang.

## Các giai đoạn

| GĐ                      | Nội dung                                                                            | Nghiệm thu                                         |
| ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| 0. Khởi tạo             | Repo, Vite + TS strict, Tailwind, Supabase cục bộ, CI, đọc cấu hình lúc chạy        | Một bản build chạy với hai CSDL khác nhau; CI xanh |
| 1. CSDL & bảo mật       | Schema gốc, RLS, lời mời, bootstrap admin, phiên bản schema, pgTAP                  | Kiểm thử RLS đạt cho cả 4 vai trò                  |
| 2. Khung ứng dụng       | Design system theo biến màu, layout công khai/quản trị, đăng nhập, phân quyền       | Đổi màu/logo trong CSDL thì giao diện đổi ngay     |
| 3. Trình cài đặt        | 9 bước, `install.php` cho cPanel, khóa sau khi cài                                  | Từ CSDL trống đến site chạy trong dưới 15 phút     |
| 4. Module nội dung      | Tin tức (TipTap), Thông báo, Văn bản, Album, Trang tĩnh, Menu                       | Tạo → duyệt → đăng; máy khác thấy ngay             |
| 5. Trang chủ & cấu hình | Trang chủ, slide, dòng chữ chạy, bật/tắt module, bộ đếm truy cập                    | Mọi chỉnh sửa quản trị hiện ra trang công khai     |
| 6. Quản trị hệ thống    | Dashboard thật, tài khoản, nhật ký, kiểm tra hệ thống                               | Mời được giáo viên làm EDITOR                      |
| 7. Sao lưu & cập nhật   | Xuất/nhập sao lưu, kiểm tra bản mới, chạy SQL nâng cấp                              | Sao lưu trường A, khôi phục sang project mới       |
| 8. SEO & hiệu năng      | OG từng bài (Vercel Function + PHP), sitemap, tối ưu ảnh, PWA                       | Lighthouse ≥ 90                                    |
| 9. Đóng gói & phát hành | GitHub Releases (`dist.zip`, `install.sql`), Deploy to Vercel, tài liệu có ảnh, E2E | Người không chuyên cài được trên cPanel            |

## Tiến độ

- [x] Giai đoạn 0: khung dự án, cấu hình lúc chạy, migration `app_meta`, CI
- [x] Giai đoạn 1: schema 0.2.0 (vai trò, lời mời, mã cài đặt, cấu hình, module, tin tức, thông báo,
      văn bản, trang, menu, media/album, Storage, nhật ký bằng trigger, bộ đếm truy cập), 62 kiểm thử pgTAP
- [x] Giai đoạn 2: màu/logo/tên trường lấy từ CSDL (áp lúc chạy), layout công khai (thanh tiện ích, banner,
      menu đa cấp từ CSDL, dòng tin chạy, chân trang có bộ đếm thật), đăng nhập, layout quản trị với menu
      theo quyền & module, bảng điều khiển số liệu thật, kiểm thử E2E (Playwright, desktop + mobile)
- [x] Giai đoạn 3: trình cài đặt 9 bước tại `/install` (bước hiện tại suy ra từ trạng thái thật nên tải lại
      trang vẫn tiếp tục đúng chỗ), `install.sql` ghép tự động từ migrations (`npm run build:install-sql`, có
      sẵn trong `dist/`), `install.php` cho cPanel (ghi config.json một lần, tự khóa + tự xóa), hướng dẫn
      Vercel/VibeHost, bản nháp kết nối dùng tạm khi chưa lưu config.json, xử lý Supabase bắt xác nhận email,
      cổng chặn dẫn về `/install` khi CSDL chưa cài xong, menu công khai ẩn module đã tắt. Schema 0.2.1 (sửa
      lỗi `pg_safeupdate` ở `bootstrap_super_admin`/`complete_install`), 64 kiểm thử pgTAP, E2E cài đặt từ
      bước 1 đến trang quản trị
- [x] Giai đoạn 4: trang quản trị + trang công khai cho Tin tức (soạn bằng TipTap, chèn ảnh, chuyên mục, thẻ,
      quy trình nháp → chờ duyệt → trả lại/đăng → gỡ, xem trước bản nháp, tìm không dấu, lượt xem), Chuyên mục &
      thẻ, Thông báo (mức độ, ghim, hết hạn tự ẩn), Văn bản (tải file PDF/Office lên Storage, lọc theo loại, tìm
      không dấu, đếm lượt tải, xem trước PDF), Thư viện ảnh (tải nhiều ảnh, tự thu nhỏ ảnh lớn, ảnh bìa, chú thích,
      sắp xếp, xem phóng to), Trang tĩnh (bố cục mặc định/toàn chiều rộng/liên hệ, SEO), Menu (2 cấp, sắp xếp,
      ẩn/hiện, chọn nhanh liên kết). Mọi HTML hiển thị qua DOMPurify. Schema 0.3.0 (chỉ người duyệt được đặt tin
      nổi bật/ngày đăng), 77 kiểm thử pgTAP, 68 unit test, E2E luồng nghiệm thu "tạo → duyệt → đăng; máy khác thấy
      ngay" bằng hai ngữ cảnh trình duyệt riêng
- [x] Giai đoạn 5: trang chủ theo cấu hình (slide tự chạy, tin nổi bật, tin mới, tin theo chuyên mục, thư viện ảnh;
      cột phải: thông báo, văn bản, bộ đếm) — quản trị bật/tắt, sắp xếp, đổi tiêu đề, số mục từng khối; quản lý
      slide có ảnh; dòng chữ chạy có liên kết và tùy chọn tự thêm tin mới; bộ đếm hôm nay/hôm qua/tháng này/tổng
      kèm số khởi điểm; trang Thông tin trường, Nhận diện (thêm banner, favicon), Module dùng lại biểu mẫu của trình
      cài đặt. Schema 0.4.0 (bảng homepage_slides, ADMIN được sửa trang chủ/dòng chữ chạy). Ảnh lưu đường dẫn trong
      bucket thay vì địa chỉ đầy đủ. Dữ liệu mẫu có ảnh, 4 văn bản PDF, 2 album, 4 slide. 94 pgTAP, 76 unit test,
      E2E kiểm tra mọi chỉnh sửa quản trị hiện ra ở trình duyệt khách
- [x] Giai đoạn 6: bảng điều khiển có biểu đồ truy cập 30 ngày, việc cần làm, hoạt động gần đây; Tài khoản (đổi vai
      trò, khóa/mở khóa, lần đăng nhập cuối, mời, gia hạn, thu hồi); đăng ký theo lời mời tại `/dang-ky`; Nhật ký lọc
      theo người, mục dữ liệu, thời gian; kiểm tra hệ thống (phiên bản schema, Storage, Auth, RLS, bucket, dung lượng).
      Schema 0.5.0 (`list_accounts`, `get_system_health`, không mời email đã có tài khoản). 118 pgTAP, 90 unit test,
      E2E nghiệm thu "mời giáo viên làm EDITOR → đăng ký → soạn bài" bằng hai ngữ cảnh trình duyệt

- [x] Giai đoạn 7: sao lưu ra file ZIP (dữ liệu + ảnh, văn bản; không có mật khẩu và mã mời), khôi phục trong một giao
      dịch sang project mới, kiểm tra bản mới trên GitHub Releases, trang Cập nhật đưa đúng SQL nâng cấp theo phiên bản
      CSDL hiện tại. Schema 0.7.0, 142 pgTAP, 98 unit test. Đã nghiệm thu trên project Supabase cục bộ thứ hai: nâng cấp 0.5.0 → 0.7.0
      bằng SQL của trang Cập nhật, sao lưu trường A, khôi phục sang project mới; CI chạy bản giả lập trong `e2e/backup.spec.ts`

- [ ] Giai đoạn 8 (đang làm):
  - [x] Phần giao diện, schema 0.8.0: menu ngang in hoa có icon chọn được trong quản trị (`menu_items.icon`, danh sách ở
        `src/features/site/menu-icons.ts`), thanh menu đáy trên điện thoại (menu `mobile`, tối đa 5 mục, có safe-area),
        module Chuyên đề (bảng `topics`, các khối nội dung lưu jsonb; tin lấy theo thẻ, tài liệu từ Văn bản, ảnh từ Thư viện
        ảnh), banner trang chủ (khối `topic_banner`, nội dung ở `site_settings.homepage.banner`, tắt sẵn khi nâng cấp)
  - [x] OG từng bài, sitemap, robots: `public/seo-core.mjs` dùng chung cho Vercel (`api/seo.mjs`) và Node (`public/server.mjs`),
        `public/seo.php` cho cPanel. Hosting thuần tĩnh không có thẻ riêng từng bài và không có sitemap
  - [x] Tối ưu ảnh: bản nhỏ 480/960/1600 tạo lúc tải lên; font tự lưu; gộp mã dùng chung; giữ chỗ để không dịch bố cục
  - [x] PWA: `public/sw.js`, manifest dựng lúc chạy theo tên trường, `offline.html`
  - [ ] Lighthouse ≥ 90: đạt trên máy tính, CHƯA đạt trên điện thoại (số đo ở mục Ghi chú kỹ thuật)

## Thứ tự bước cài đặt (đã chốt ở Giai đoạn 1)

Tạo quản trị viên trước, các bước cấu hình sau chạy khi đã đăng nhập (mọi thao tác ghi đều qua RLS):

1. Chào mừng & kiểm tra môi trường
2. Kết nối Supabase (URL + anon key)
3. Chạy `install.sql` trong SQL Editor; kết quả hiện **mã cài đặt**
4. Lưu `config.json` (tự ghi qua `install.php` trên cPanel, hoặc tải về rồi upload)
5. Tạo tài khoản + nhập mã cài đặt → trở thành Quản trị viên cấp cao (`bootstrap_super_admin`)
6. Thông tin nhà trường
7. Nhận diện: logo, màu sắc, khẩu hiệu
8. Chọn module
9. Hoàn tất (`complete_install`)

## Ghi chú kỹ thuật

- Bảng mới phải tự `GRANT` cho `anon`/`authenticated` (migration grants đã đóng quyền mặc định).
- Đăng ký email chưa được mời bị CSDL từ chối; Supabase Auth trả "Database error saving new user"
  nên giao diện cần dịch thông báo này.
- **Mọi UPDATE/DELETE trong hàm phải có WHERE**: Supabase bật `pg_safeupdate` cho yêu cầu qua API (kể cả hàm
  security definer). pgTAP không chịu ràng buộc này nên có kiểm thử quét mã nguồn hàm
  (`no_unqualified_writes_test.sql`); E2E gọi qua API thật.
- Thứ tự ưu tiên cấu hình kết nối: `/config.json` → biến `VITE_*` (lúc build) → bản nháp của trình cài đặt
  (localStorage, chỉ trình duyệt của người đang cài). Vercel dùng biến môi trường + Redeploy.
- `install.php` chỉ ghi khi chưa có `config.json`/`.eschool-install.lock`, từ chối khóa service_role/secret.
  Rủi ro còn lại: trong khoảng giữa lúc tải code lên và lúc cài, người lạ có thể ghi trước; khi đó xóa hai file
  trên bằng File Manager rồi cài lại. Kiểm thử: `npm run test:php` (máy không có PHP: `PHP_DOCKER=1`).
- E2E cài đặt chạy dev server thứ hai ở cổng 3001 không có cấu hình, dùng `pg` đưa CSDL seed về trạng thái chưa
  cài (bỏ SUPER_ADMIN, đặt lại mã cài đặt) rồi khôi phục sau khi chạy; mọi test chạy tuần tự (`workers: 1`).
- Dùng cùng một bản Supabase CLI cho `start` và `db reset` (`npx supabase` có thể khác bản cài trên máy): lệch bản
  làm schema storage không khớp container, tải file lên báo lỗi 42P10.
- **Trang công khai phải lọc `status = 'published'` tường minh**: RLS cho nhân sự đăng nhập đọc cả bản nháp, nên
  thiếu bộ lọc thì nhân sự xem trang công khai sẽ thấy bài chưa đăng. Trang chi tiết cố ý không lọc để nhân sự
  xem trước, kèm dải "Bản xem trước".
- Album chỉ cho người có `media.manage` (ADMIN trở lên); biên tập viên tải ảnh trực tiếp trong trình soạn thảo.
  Xóa văn bản/album xóa luôn file trong Storage (qua API, không xóa thẳng bảng `storage.objects`).
- E2E nội dung tạo dữ liệu tiền tố `E2E` và dọn trong `afterAll`, nên chạy `db:test` sau E2E vẫn đúng số liệu seed.
- **Ảnh lưu đường dẫn trong bucket media** (vd `seed/logo.jpg`), giao diện đổi thành địa chỉ công khai bằng
  `resolveMediaUrl`; giá trị cũ dạng `https://...` vẫn dùng được. Nhờ vậy sao lưu/khôi phục sang project khác (GĐ7)
  không phải sửa địa chỉ. Ảnh chèn trong nội dung bài viết vẫn là địa chỉ đầy đủ.
- Dữ liệu mẫu: file thật ở `supabase/seed-storage/<bucket>/seed/...`, `npm run db:reset` chạy `db reset` rồi
  `scripts/seed-storage.ts` (khóa service_role từ `supabase status`, chỉ chạy với Supabase cục bộ). Tạo lại ảnh/PDF:
  `node scripts/make-seed-assets.ts <thư-mục-ảnh-gốc>` (Chromium của Playwright nén ảnh, in PDF tiếng Việt).
  Ảnh lấy từ bản demo cũ (ảnh AI); hai ảnh album có chữ tên trường khác, nên thay khi có ảnh thật.
- Zod 4: khóa không có trong JSON thì `z.unknown()` báo lỗi, phải thêm `.optional()` (đã gặp với `sections`).
- **Lời mời không tự gửi thư**: website tĩnh chỉ có khóa anon, không gọi được API gửi thư mời của Supabase. Người mời
  gửi liên kết `/dang-ky?email=...&ma=...` qua email (nút soạn thư sẵn) hoặc Zalo. Mã bí mật (schema 0.6.0) đi qua
  `raw_user_meta_data`; CSDL đòi đúng cả email lẫn mã, nên biết email thôi không đăng ký thay được.
- Quên mật khẩu: `/quen-mat-khau` → thư Supabase → `/dat-lai-mat-khau`. Liên kết chỉ quay về đúng website khi Site URL
  (Authentication → URL Configuration) trùng tên miền. Máy chủ thư miễn phí của Supabase chỉ gửi vài thư mỗi giờ.
- Lời mời hết hạn vẫn giữ chỗ email (chỉ mục duy nhất), phải gia hạn hoặc thu hồi trước khi mời lại. Gia hạn đặt
  `invited_by` thành người thao tác vì chính sách RLS yêu cầu vậy.
- Ô chọn có kiểm soát: đọc `e.target.value` ngay trong handler, không đọc trong closure chạy sau. Trong bảng cuộn ngang,
  không dùng `sr-only` ở tiêu đề cột (phần tử absolute thoát khỏi khung cuộn, kéo giãn cả trang trên điện thoại).
- **Sao lưu**: `export_backup`/`restore_backup` chạy trên CSDL; file do trình duyệt tải và đóng gói ZIP không nén
  (`Blob.slice` để đọc nên không nạp cả file vào RAM). Khôi phục tải file lên trước, dữ liệu sau trong một giao dịch nên
  lỗi giữa chừng không mất dữ liệu; file thừa trên project đích không bị xóa. Hồ sơ cùng email khác id được đổi tham chiếu
  sang id đang có. Tài khoản tạo lại chưa có mật khẩu (dùng Quên mật khẩu). Nhật ký cũ được giữ, không xóa được bằng khôi phục.
  Bảng nghiệp vụ mới phải thêm vào `private.backup_content_tables` và danh sách xóa trong `restore_backup`.
- **Khối chuyên đề**: `parseTopicSections` bỏ qua khối sai hoặc loại chưa biết thay vì làm hỏng cả trang. Thêm loại khối mới:
  sửa `src/features/topics/sections.ts`, `SectionsEditor`, `TopicPages`. Khối video chỉ tải YouTube khi người xem bấm phát.
- **Khối trang chủ mới** bật sẵn khi vắng trong cấu hình cũ, trừ khối có `defaultOff` trong `SECTION_INFO`.
- **SEO**: sửa `seo-core.mjs` thì sửa cả `seo.php`; `npm run test:seo` chạy cùng một bộ kiểm tra cho cả hai. Trên Vercel, `/` là file
  tĩnh nên trang chủ không có thẻ theo tên trường (các trang chi tiết thì có). Supabase trả tối đa 1000 dòng mỗi bảng cho sitemap.
- **Ảnh**: gói miễn phí của Supabase không đổi kích thước ảnh nên `uploadImage` tải kèm bản nhỏ; đuôi tên `-rsw`/`-rsj` báo có bản nhỏ,
  ảnh cũ không có đuôi này vẫn chạy bằng ảnh gốc. Ảnh chèn trong thân bài viết chưa dùng bản nhỏ.
- **Lighthouse** (2026-10-31, Lighthouse 12, bản build chạy bằng `server.mjs`, Supabase cục bộ, dữ liệu mẫu). Hiệu năng trên máy tính
  94-99, trên điện thoại giả lập 4G chậm 73-80 (LCP 4,4-6,4 giây); Trợ năng 93-96, Thực hành tốt 100, SEO 100. Chưa đạt 90 trên điện thoại vì
  ứng dụng render phía trình duyệt, gần 200 KB gzip JS phải tải xong mới có nội dung; muốn đạt cần prerender hoặc tách bớt Supabase/Zod.
- **Nâng cấp**: mỗi lần tăng `schema_version` là một bước; `buildUpgrades` sinh `/upgrades/<phiên-bản>.sql` và `index.json`
  từ migrations, mỗi file kiểm tra phiên bản trước khi chạy và nằm trong giao dịch.
- Tài khoản demo khi chạy trên máy (mật khẩu `demo1234`): `superadmin@demo.local`, `admin@demo.local`,
  `editor@demo.local`.
