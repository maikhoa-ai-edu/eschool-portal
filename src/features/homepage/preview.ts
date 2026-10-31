import { homepageSchema, type HomepageSettings } from '@/features/site/homepage-settings'

const PREVIEW_KEY = 'eschool:homepage-preview'

/** Lưu bản nháp bố cục để tab xem trước đọc; chỉ nằm trong trình duyệt này, không ghi vào CSDL. */
export function writePreviewDraft(draft: HomepageSettings): boolean {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

/** Đọc qua cùng bộ chuẩn hóa như cấu hình thật nên dữ liệu sai không làm hỏng trang. */
export function readPreviewDraft(): HomepageSettings | null {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY)
    return raw ? homepageSchema.parse(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
