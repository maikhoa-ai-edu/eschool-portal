/**
 * Tự đăng xuất: hết phiên khi không thao tác quá lâu, hoặc khi đã đăng nhập quá số giờ tối đa (tắt máy hôm nay,
 * mai mở lại phải đăng nhập lại). Gói Supabase miễn phí không giới hạn được phiên phía máy chủ nên trình duyệt tự
 * kiểm tra và đăng xuất.
 */

export const DEFAULT_IDLE_MINUTES = 60
export const DEFAULT_MAX_HOURS = 12
export const IDLE_MINUTES_RANGE = { min: 15, max: 480 } as const
export const MAX_HOURS_RANGE = { min: 1, max: 72 } as const

/** Báo trước khi tự đăng xuất vì không thao tác */
export const IDLE_WARNING_MS = 2 * 60 * 1000
/** Báo trước khi hết số giờ tối đa, để kịp lưu bài đang soạn */
export const MAX_WARNING_MS = 10 * 60 * 1000

/** Thời điểm thao tác gần nhất, dùng chung giữa các tab */
export const ACTIVITY_KEY = 'eschool:last-activity'
/** Lý do vừa bị đăng xuất, để trang đăng nhập báo lại */
export const EXPIRED_KEY = 'eschool:session-expired'

export interface SessionLimits {
  idleMs: number
  maxMs: number
}

export type ExpiryReason = 'idle' | 'max'

export interface SessionCheck {
  /** Đã hết phiên vì lý do này */
  expired: ExpiryReason | null
  /** Sắp hết phiên: lý do và thời điểm hết */
  warning: { reason: ExpiryReason; at: number } | null
}

export function sessionLimits(idleMinutes: number, maxHours: number): SessionLimits {
  return { idleMs: idleMinutes * 60 * 1000, maxMs: maxHours * 60 * 60 * 1000 }
}

/**
 * Thời điểm đăng nhập (ms) lấy từ claim `amr` của access token. Claim này giữ nguyên qua các lần làm mới token,
 * khác `iat`. Đọc không được thì trả null.
 */
export function loginTimeFromToken(accessToken: string): number | null {
  try {
    const part = accessToken.split('.')[1]
    if (!part) return null
    const base64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { amr?: Array<{ timestamp?: unknown }> }
    const stamps = (payload.amr ?? [])
      .map((entry) => entry.timestamp)
      .filter((t): t is number => typeof t === 'number' && t > 0)
    return stamps.length > 0 ? Math.min(...stamps) * 1000 : null
  } catch {
    return null
  }
}

/**
 * Kiểm tra phiên tại thời điểm `now`. Thao tác gần nhất không tính trước lúc đăng nhập: dấu thao tác cũ của phiên
 * trước không làm phiên mới hết hạn, còn phiên mở lại sau nhiều ngày thì tính từ lúc đăng nhập.
 */
export function checkSession(
  { loginAt, lastActivity, now }: { loginAt: number; lastActivity: number | null; now: number },
  { idleMs, maxMs }: SessionLimits,
): SessionCheck {
  const idleAt = Math.max(lastActivity ?? 0, loginAt) + idleMs
  const maxAt = loginAt + maxMs
  if (now >= maxAt) return { expired: 'max', warning: null }
  if (now >= idleAt) return { expired: 'idle', warning: null }
  // Chỉ báo mốc đến trước
  const reason: ExpiryReason = maxAt <= idleAt ? 'max' : 'idle'
  const at = reason === 'max' ? maxAt : idleAt
  const notice = reason === 'max' ? MAX_WARNING_MS : IDLE_WARNING_MS
  return { expired: null, warning: at - now <= notice ? { reason, at } : null }
}

export function readLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function writeLastActivity(time: number): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(time))
  } catch {
    // Trình duyệt chặn localStorage: mỗi tab tự tính theo lúc đăng nhập
  }
}

export const EXPIRY_MESSAGES: Record<ExpiryReason, string> = {
  idle: 'Bạn đã được đăng xuất vì không thao tác trong thời gian dài. Vui lòng đăng nhập lại.',
  max: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}
