const TIME_ZONE = 'Asia/Ho_Chi_Minh'

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const numberFormat = new Intl.NumberFormat('vi-VN')

/** Ngày dạng 05/09/2026. Nhận timestamptz hoặc cột date (yyyy-mm-dd, hiểu theo giờ Việt Nam). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormat.format(date)
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/**
 * Chuyển timestamptz sang giá trị cho <input type="datetime-local"> theo giờ Việt Nam
 * (không phụ thuộc múi giờ của máy đang mở trang).
 */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

/** Ngược lại với toDateTimeLocal: '2026-09-05T07:30' (giờ Việt Nam) -> ISO; rỗng -> null. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}:00+07:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
