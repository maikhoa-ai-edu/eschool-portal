/** Đổi thông báo lỗi (tiếng Anh) của Supabase sang câu tiếng Việt dễ hiểu. */
const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Email hoặc mật khẩu không đúng.'],
  [/email not confirmed/i, 'Email chưa được xác nhận. Vui lòng mở hộp thư và bấm vào liên kết xác nhận.'],
  // CSDL từ chối đăng ký email chưa được mời (trigger handle_new_user)
  [
    /database error saving new user/i,
    'Lời mời không hợp lệ hoặc đã hết hạn. Hãy liên hệ quản trị viên để được mời lại.',
  ],
  [/user already registered/i, 'Email này đã có tài khoản. Hãy đăng nhập.'],
  [
    /signups? not allowed/i,
    'Project Supabase đang tắt đăng ký tài khoản (Authentication → Sign In / Providers).',
  ],
  [/email address .* is invalid/i, 'Địa chỉ email không hợp lệ.'],
  [
    /captcha/i,
    'Chưa qua được bước xác minh. Hãy tích vào ô xác minh rồi thử lại; nếu không thấy ô này, báo quản trị viên kiểm tra cấu hình captcha.',
  ],
  [/invalid api key/i, 'Khóa anon không đúng hoặc không thuộc project này.'],
  [/could not find the (function|table)/i, 'Cơ sở dữ liệu chưa được khởi tạo (chưa chạy install.sql).'],
  [/password should be at least/i, 'Mật khẩu quá ngắn.'],
  [/new password should be different/i, 'Mật khẩu mới phải khác mật khẩu cũ.'],
  [/rate limit|too many requests/i, 'Thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.'],
  [/failed to fetch|network/i, 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'],
  [/row-level security|permission denied|42501/i, 'Bạn không có quyền thực hiện thao tác này.'],
  [/duplicate key value/i, 'Dữ liệu bị trùng (ví dụ đường dẫn đã tồn tại).'],
  [
    /violates foreign key constraint|23503/i,
    'Không xóa được vì dữ liệu đang được sử dụng (ví dụ chuyên mục vẫn còn bài viết).',
  ],
  [/exceeded the maximum allowed size|payload too large/i, 'File quá lớn so với giới hạn cho phép.'],
  [/mime type .* is not supported|invalid_mime_type/i, 'Định dạng file không được hỗ trợ.'],
]

export function toVietnameseError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? '')

  for (const [pattern, text] of KNOWN_ERRORS) {
    if (pattern.test(message)) return text
  }
  return message || 'Đã xảy ra lỗi không xác định.'
}
