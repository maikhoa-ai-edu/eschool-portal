import { formatFileSize, formatNumber } from '@/lib/format'

export type CheckStatus = 'ok' | 'warning' | 'error' | 'info'

export interface SystemCheck {
  label: string
  status: CheckStatus
  detail: string
}

export function checkSchemaVersion(actual: string, required: string): SystemCheck {
  return actual === required
    ? { label: 'Phiên bản CSDL', status: 'ok', detail: actual }
    : {
        label: 'Phiên bản CSDL',
        status: 'error',
        detail: `CSDL ${actual}, bản website này cần ${required}. Hãy chạy file SQL nâng cấp.`,
      }
}

export interface AuthSettings {
  disable_signup?: boolean
  mailer_autoconfirm?: boolean
}

export function checkAuthSettings(settings: AuthSettings): SystemCheck[] {
  return [
    settings.disable_signup
      ? {
          label: 'Đăng ký theo lời mời',
          status: 'error',
          detail:
            'Supabase đang tắt đăng ký nên người được mời không tạo được tài khoản (Authentication → Sign In / Providers).',
        }
      : { label: 'Đăng ký theo lời mời', status: 'ok', detail: 'Đang mở; CSDL chỉ nhận email được mời.' },
    settings.mailer_autoconfirm
      ? {
          label: 'Xác nhận email',
          status: 'info',
          detail: 'Đang tắt: ai có liên kết mời tạo được tài khoản ngay, không cần mở hộp thư.',
        }
      : { label: 'Xác nhận email', status: 'ok', detail: 'Đang bật.' },
  ]
}

export interface SystemHealth {
  database_size: number
  install_completed: boolean
  buckets: Array<{ id: string; public: boolean; file_count: number; total_size: number }>
  tables_without_rls: string[]
  accounts: { active: number; locked: number; super_admins: number }
  invitations: { open: number; expired: number }
  modules: { enabled: number; total: number }
  audit: { total: number; last_at: string | null }
}

const REQUIRED_BUCKETS = ['media', 'documents']

export function checkHealth(health: SystemHealth): SystemCheck[] {
  const missing = REQUIRED_BUCKETS.filter((id) => !health.buckets.some((b) => b.id === id && b.public))
  const files = health.buckets.reduce((sum, b) => sum + b.file_count, 0)
  const fileSize = health.buckets.reduce((sum, b) => sum + b.total_size, 0)
  const noRls = health.tables_without_rls

  return [
    health.install_completed
      ? { label: 'Cài đặt', status: 'ok', detail: 'Đã hoàn tất.' }
      : { label: 'Cài đặt', status: 'warning', detail: 'Chưa hoàn tất trình cài đặt.' },
    noRls.length > 0
      ? { label: 'Bảo vệ dữ liệu (RLS)', status: 'error', detail: `Chưa bật ở: ${noRls.join(', ')}` }
      : { label: 'Bảo vệ dữ liệu (RLS)', status: 'ok', detail: 'Mọi bảng đều đã bật.' },
    missing.length > 0
      ? {
          label: 'Kho lưu trữ',
          status: 'error',
          detail: `Thiếu hoặc chưa công khai bucket: ${missing.join(', ')}`,
        }
      : {
          label: 'Kho lưu trữ',
          status: 'ok',
          detail: `${formatNumber(files)} file, ${formatFileSize(fileSize)}`,
        },
    { label: 'Dung lượng CSDL', status: 'info', detail: formatFileSize(health.database_size) },
    health.accounts.super_admins === 0
      ? { label: 'Quản trị viên cấp cao', status: 'error', detail: 'Không còn ai đang hoạt động.' }
      : health.accounts.super_admins === 1
        ? {
            label: 'Quản trị viên cấp cao',
            status: 'warning',
            detail: 'Chỉ có 1 người. Nên có thêm một người dự phòng.',
          }
        : {
            label: 'Quản trị viên cấp cao',
            status: 'ok',
            detail: `${formatNumber(health.accounts.super_admins)} người`,
          },
    {
      label: 'Tài khoản',
      status: 'info',
      detail: `${formatNumber(health.accounts.active)} đang hoạt động, ${formatNumber(health.accounts.locked)} đã khóa`,
    },
    health.invitations.expired > 0
      ? {
          label: 'Lời mời',
          status: 'warning',
          detail: `${formatNumber(health.invitations.open)} đang mở, ${formatNumber(health.invitations.expired)} đã hết hạn`,
        }
      : { label: 'Lời mời', status: 'ok', detail: `${formatNumber(health.invitations.open)} đang mở` },
    {
      label: 'Module',
      status: 'info',
      detail: `Đang bật ${formatNumber(health.modules.enabled)}/${formatNumber(health.modules.total)}`,
    },
    { label: 'Nhật ký', status: 'info', detail: `${formatNumber(health.audit.total)} dòng` },
  ]
}
