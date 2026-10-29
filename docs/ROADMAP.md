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
- [ ] Giai đoạn 1
