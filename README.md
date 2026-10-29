# eSchool Portal

Cổng thông tin điện tử dành cho trường phổ thông Việt Nam: tin tức, thông báo, văn bản, thư viện ảnh, trang giới thiệu và trang quản trị. Mỗi trường tự cài một bản riêng, dùng cơ sở dữ liệu riêng, tự chọn tên trường, logo, màu sắc và các module cần dùng.

> Trạng thái: **đang phát triển (Giai đoạn 0)**. Xem [docs/ROADMAP.md](docs/ROADMAP.md).

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
| `npm run db:reset`                                | Tạo lại CSDL trên máy từ migrations + seed                                                     |
| `npm run db:test`                                 | Chạy kiểm thử CSDL (pgTAP)                                                                     |
| `npm run db:types`                                | Sinh kiểu TypeScript từ CSDL                                                                   |

## Cài đặt cho trường

Hướng dẫn chi tiết (có ảnh) sẽ có ở Giai đoạn 9. Tóm tắt: tạo project Supabase → tải bản phát hành `dist.zip` lên hosting (hoặc deploy từ GitHub lên Vercel) → mở website và làm theo trình cài đặt.

## Bản quyền

Thiết kế bởi MVK. Phát hành theo [giấy phép MIT](LICENSE): được tự do sử dụng, sửa đổi và phân phối, với điều kiện giữ nguyên thông báo bản quyền. Mong các trường sử dụng giữ dòng ghi công "Thiết kế bởi MVK" ở chân trang.
