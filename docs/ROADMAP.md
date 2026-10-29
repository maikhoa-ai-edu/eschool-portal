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
- Tài khoản demo khi chạy trên máy (mật khẩu `demo1234`): `superadmin@demo.local`, `admin@demo.local`,
  `editor@demo.local`.
