# eSchool Portal

Cổng thông tin điện tử dành cho trường phổ thông Việt Nam: tin tức, thông báo, văn bản, thư viện ảnh, trang giới thiệu và trang quản trị. Mỗi trường tự cài một bản riêng, dùng cơ sở dữ liệu riêng, tự chọn tên trường, logo, màu sắc và các module cần dùng.

> Trạng thái: **đang phát triển (xong Giai đoạn 5: trang chủ & cấu hình)**. Xem [docs/ROADMAP.md](docs/ROADMAP.md).

## Quy trình đăng tin

Biên tập viên (giáo viên) soạn bài bằng trình soạn thảo, chèn ảnh rồi **Gửi duyệt**. Quản trị nội dung mở mục
"Tin chờ duyệt" để **Duyệt & đăng** hoặc **Trả lại tác giả** kèm góp ý; bài đã đăng có thể **Gỡ bài**. Quyền này
được CSDL kiểm tra (biên tập viên không thể tự đăng, tự đánh dấu nổi bật hay sửa bài đã đăng), giao diện chỉ ẩn
nút không dùng được.

## Kiến trúc tóm tắt

- **Giao diện:** ứng dụng React tĩnh (Vite). Cùng một bản build chạy được trên Vercel, cPanel, VibeHost hay bất kỳ hosting nào phục vụ file tĩnh.
- **Dữ liệu:** mỗi trường một project [Supabase](https://supabase.com) riêng (PostgreSQL, đăng nhập, lưu trữ file). Quyền truy cập được kiểm soát bằng Row Level Security trong CSDL.
- **Cấu hình kết nối:** đọc lúc chạy từ file `/config.json` do trình cài đặt tạo ra, không cần build lại cho từng trường.

## Chạy trên máy (dành cho lập trình viên)

Cần có: Node.js 22+, Docker Desktop (đang chạy), [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
npm run db:start          # khởi động Supabase trên máy (lần đầu tải image hơi lâu)
cp .env.example .env.local
# dán "anon key" từ kết quả lệnh `supabase status` vào VITE_SUPABASE_ANON_KEY trong .env.local
npm run dev               # mở http://localhost:3000
```

Các lệnh khác:

| Lệnh                                              | Tác dụng                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run typecheck` / `npm run lint` / `npm test` | Kiểm tra kiểu, lint, unit test                                                                 |
| `npm run build`                                   | Build ra thư mục `dist/`                                                                       |
| `npm run test:e2e`                                | Kiểm thử đầu-cuối bằng trình duyệt (Playwright; cần `npx playwright install chromium` lần đầu) |
| `npm run db:reset`                                | Tạo lại CSDL trên máy từ migrations + seed, tải ảnh & văn bản mẫu lên Storage cục bộ           |
| `npm run db:test`                                 | Chạy kiểm thử CSDL (pgTAP)                                                                     |
| `npm run db:types`                                | Sinh kiểu TypeScript từ CSDL                                                                   |
| `npm run build:install-sql`                       | Ghép migrations thành `dist/install.sql` (bản build cũng tự có file này)                       |
| `npm run test:php`                                | Kiểm thử `install.php` (máy không cài PHP: đặt `PHP_DOCKER=1` để chạy qua Docker)              |

## Cài đặt cho trường

Hướng dẫn chi tiết (có ảnh) sẽ có ở Giai đoạn 9. Tóm tắt:

1. Tạo một project [Supabase](https://supabase.com/dashboard/new) (gói miễn phí là đủ).
2. Đưa website lên hosting: giải nén bản phát hành vào thư mục web (cPanel, VibeHost: nhớ tải cả file ẩn `.htaccess`), hoặc deploy từ GitHub lên Vercel.
3. Mở website: trình cài đặt hiện ra và hướng dẫn 9 bước (kết nối Supabase, chạy `install.sql` trong SQL Editor để lấy mã cài đặt, lưu cấu hình, tạo quản trị viên, thông tin trường, logo & màu sắc, chọn module).

Cách lưu cấu hình kết nối theo từng loại hosting:

| Hosting                | Cách lưu `config.json`                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| cPanel (có PHP)        | Trình cài đặt tự ghi qua `install.php`; ghi xong file này tự khóa và tự xóa    |
| Vercel                 | Đặt biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` rồi Redeploy |
| VibeHost, hosting khác | Tải `config.json` từ trình cài đặt rồi tải lên cùng thư mục với `index.html`   |

Muốn cài lại trên cPanel: xóa `config.json` và `.eschool-install.lock` bằng File Manager.

## Bản quyền

Thiết kế bởi MVK. Phát hành theo [giấy phép MIT](LICENSE): được tự do sử dụng, sửa đổi và phân phối, với điều kiện giữ nguyên thông báo bản quyền. Mong các trường sử dụng giữ dòng ghi công "Thiết kế bởi MVK" ở chân trang.
