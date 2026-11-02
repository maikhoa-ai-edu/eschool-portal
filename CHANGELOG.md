# Lịch sử phiên bản

Mỗi bản phát hành có một mục ở đây; workflow phát hành lấy nội dung này làm ghi chú. Số phiên bản website và số phiên bản cơ sở dữ liệu tách riêng: cơ sở dữ liệu chỉ tăng số khi cấu trúc đổi.

## 0.12.0

Cần nâng cấp cơ sở dữ liệu lên 0.12.0 (trang Cập nhật hướng dẫn cách làm).

- Khi soạn bài có ô "Hiển thị trên slide", chỉ người có quyền duyệt bài mới thấy. Bài đã đăng và có ảnh đại diện sẽ hiện ở slide trang chủ, sau các slide tạo tay; gỡ bài thì slide tự mất.
- Tab Bố cục có thêm số bài tối đa trên slide (mặc định 5) và công tắc "Tự lấy tin mới nhất có ảnh" (mặc định tắt), dùng khi không có slide tạo tay và không có bài nào được tick.
- Bài đang ở slide không lặp lại ở cột Tiêu điểm, dải tin và các khối Tin nổi bật, Tin mới nhất.
- Trường không tick bài nào và không bật công tắc thì giao diện giữ nguyên.

## 0.11.1

Không cần nâng cấp cơ sở dữ liệu.

- Trang bài viết có nút chia sẻ Facebook và Zalo. Trên điện thoại, nút Zalo mở bảng chia sẻ của máy; trên máy tính, nút này chép liên kết để dán vào Zalo.
- Khối Chuyên mục ở cột phải có nền màu, đường chia dòng, biểu tượng và đánh dấu chuyên mục của bài đang đọc. Giao diện mới áp dụng cho mọi trường, màu vẫn theo màu của trường.
- Tăng độ tương phản của menu đang chọn và nhãn chuyên mục: dùng sắc đậm hơn của màu nhấn, màu đã lưu của trường không đổi.
- Trên Vercel không còn tải công khai được `install.php`, `seo.php`, `seo-core.mjs`, `server.mjs`. Gói cPanel và Node.js giữ nguyên.
- Bổ sung hướng dẫn cài đặt: cảnh báo RLS trong SQL Editor, Production Branch trên Vercel, cảnh báo khi thêm biến môi trường.

## 0.11.0

Bản phát hành đầu tiên, dùng cho các trường thử nghiệm.

- Trang công khai: tin tức, thông báo, văn bản, thư viện ảnh, video, tài nguyên, kế hoạch công tác, chuyên đề, trang Giới thiệu, Cơ cấu tổ chức, Sơ đồ trang.
- Quản trị: bố cục trang chủ, tài khoản theo nhóm, bình luận có duyệt, nhật ký, sao lưu và khôi phục, cập nhật.
- Cài trên Vercel, cPanel hoặc hosting có Node.js; có hướng dẫn tiếng Việt từng bước.
