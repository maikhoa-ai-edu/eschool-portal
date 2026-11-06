# Lịch sử phiên bản

Mỗi bản phát hành có một mục ở đây; workflow phát hành lấy nội dung này làm ghi chú. Số phiên bản website và số phiên bản cơ sở dữ liệu tách riêng: cơ sở dữ liệu chỉ tăng số khi cấu trúc đổi.

## 0.14.0

Cần nâng cấp cơ sở dữ liệu lên 0.14.0 (trang Cập nhật hướng dẫn cách làm). Sao lưu trước khi nâng cấp.

- Cuộc thi viết: mục quản trị mới **Cuộc thi** (tên, thẻ của bài dự thi, hạn bình chọn), bảng xếp hạng theo từng loại cảm xúc và nút tải file Excel (CSV). Bài dự thi là bài viết ở mục Tin tức có gắn thẻ của cuộc thi; giáo viên nhập thay học sinh, điền tên học sinh vào ô Tác giả và ô **Lớp** mới.
- Chuyên đề có khối mới **Bài dự thi (lưới)**: ảnh, tên bài, học sinh và lớp, đoạn trích (không có tóm tắt thì lấy đầu bài), số cảm xúc; sắp xếp theo mới đăng hoặc nhiều cảm xúc nhất.
- Bài viết có **Kiểu trình bày: Thư tri ân**: nền giấy, khung viền, họa tiết góc, chữ có chân, ký tên học sinh cuối bài. Bài cũ giữ kiểu Bình thường.
- **Cảm xúc dưới bài** (Thích, Yêu thích, Tuyệt vời, Biết ơn): chỉ tài khoản đã đăng nhập, mỗi tài khoản một lượt cho một bài; sau hạn bình chọn của cuộc thi không thêm, đổi hay bỏ được. Module **Cảm xúc bài viết** tắt sẵn ở trường đang chạy, bật trong Quản trị → Module. Muốn phụ huynh, học sinh bình chọn thì bật thêm "Cho phép tự đăng ký thành viên" (đăng nhập Google).
- **Bình luận kiểu mạng xã hội**: ảnh đại diện chữ cái, bong bóng, thời gian kiểu "2 giờ trước", nút Thích và Trả lời (một cấp). Trả lời cũng phải được duyệt.
- **Nút quản trị trên trang công khai**: người có quyền thấy thanh "Quản trị" (Sửa, Thêm mới) ở bài viết, thông báo, văn bản, album, trang tĩnh, chuyên đề và các trang danh sách; bấm vào mở đúng trang quản trị. Khách không thấy.
- **Tác giả sửa bài đã đăng của mình**: khi lưu, bài về Chờ duyệt và tạm ẩn tới khi được duyệt lại. Bài dự thi đã đăng thì tác giả không sửa được.
- Trang Liên hệ: điện thoại các bộ phận (có nút Nhắn Zalo), giờ làm việc, kênh liên lạc khác, bản đồ. Mục trống tự ẩn nên trang Liên hệ hiện có giữ nguyên tới khi nhập.
- Nút **Sao chép liên kết** cạnh nút chia sẻ Facebook, Zalo.

## 0.13.0

Cần nâng cấp cơ sở dữ liệu lên 0.13.0 (trang Cập nhật hướng dẫn cách làm).

- Tự đăng xuất: không thao tác 60 phút thì tự đăng xuất (có hộp báo trước 2 phút), và phải đăng nhập lại sau 12 giờ kể từ lúc đăng nhập. Hai con số chỉnh được ở Thông tin trường, mục Tự đăng xuất. Áp dụng cho mọi tài khoản.
- Trang quản trị có chấm đỏ số trắng ở menu và chuông trên thanh đầu trang: bài chờ duyệt, bài của mình bị trả lại, bình luận chờ duyệt, có bản mới hoặc CSDL cần nâng cấp. Số tự làm mới mỗi phút.
- Trang quản trị có chân trang: tên trường, phiên bản website và CSDL, hạ tầng, ghi công thiết kế.
- Nút lên đầu trang hiện khi kéo xuống, ở mọi trang công khai và trang quản trị. Trên điện thoại, nút nằm trên thanh menu đáy. Đây là thay đổi giao diện chung, áp dụng cho mọi trường.
- Website trên Vercel tự gọi vào cơ sở dữ liệu mỗi ngày (Vercel Cron) để Supabase gói miễn phí không tạm dừng project sau 7 ngày vắng khách; máy chủ Node tự gọi tương tự. cPanel cần tạo một Cron Job (xem hướng dẫn cài đặt, Phần 5).
- Sửa lỗi: vai trò Ban giám hiệu được quản lý Cơ cấu tổ chức như Quản trị viên.

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
