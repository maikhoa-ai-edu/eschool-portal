export const INSTALL_STEPS = [
  'Kiểm tra môi trường',
  'Kết nối Supabase',
  'Khởi tạo cơ sở dữ liệu',
  'Lưu cấu hình',
  'Tạo quản trị viên',
  'Thông tin nhà trường',
  'Logo, màu sắc, khẩu hiệu',
  'Chọn module',
  'Hoàn tất',
] as const

export const TOTAL_STEPS = INSTALL_STEPS.length

export const MODULE_INFO: Record<string, { label: string; description: string }> = {
  news: { label: 'Tin tức', description: 'Bài viết theo chuyên mục, quy trình gửi duyệt và đăng tin.' },
  announcements: { label: 'Thông báo', description: 'Thông báo ngắn, có thể ghim lên đầu trang.' },
  documents: { label: 'Văn bản', description: 'Công văn, kế hoạch, biểu mẫu cho phép tải về.' },
  albums: { label: 'Thư viện ảnh', description: 'Album ảnh hoạt động của nhà trường.' },
  pages: { label: 'Trang thông tin', description: 'Giới thiệu, cơ cấu tổ chức, lịch sử nhà trường...' },
  topics: {
    label: 'Chuyên đề',
    description: 'Trang chuyên đề riêng cho một chủ đề, phong trào của nhà trường.',
  },
}
