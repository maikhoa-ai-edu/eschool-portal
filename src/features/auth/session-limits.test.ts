import { describe, expect, it } from 'vitest'
import { checkSession, loginTimeFromToken, sessionLimits } from './session-limits'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const limits = sessionLimits(60, 12)
const loginAt = Date.UTC(2026, 10, 3, 7, 0)

function token(payload: object): string {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.chuky`
}

describe('loginTimeFromToken', () => {
  it('Lấy thời điểm đăng nhập từ amr, không phải iat', () => {
    const t = token({ iat: 1_900_000_000, amr: [{ method: 'password', timestamp: 1_800_000_000 }] })
    expect(loginTimeFromToken(t)).toBe(1_800_000_000_000)
  })

  it('Đọc được payload có chữ tiếng Việt', () => {
    const t = token({
      amr: [{ method: 'oauth', timestamp: 1_800_000_000 }],
      user_metadata: { full_name: 'Nguyễn Văn Ả' },
    })
    expect(loginTimeFromToken(t)).toBe(1_800_000_000_000)
  })

  it('Token hỏng hoặc thiếu amr thì trả null', () => {
    expect(loginTimeFromToken('khong-phai-token')).toBeNull()
    expect(loginTimeFromToken(token({ iat: 1 }))).toBeNull()
  })
})

describe('checkSession', () => {
  it('Đang thao tác thì còn phiên, không báo gì', () => {
    const now = loginAt + 2 * HOUR
    expect(checkSession({ loginAt, lastActivity: now - 5 * MIN, now }, limits)).toEqual({
      expired: null,
      warning: null,
    })
  })

  it('Không thao tác quá 60 phút thì hết phiên, báo trước 2 phút', () => {
    const last = loginAt + HOUR
    expect(checkSession({ loginAt, lastActivity: last, now: last + 59 * MIN }, limits).warning).toEqual({
      reason: 'idle',
      at: last + HOUR,
    })
    expect(checkSession({ loginAt, lastActivity: last, now: last + HOUR }, limits).expired).toBe('idle')
  })

  it('Tắt máy hôm nay, sáng mai mở lại thì phải đăng nhập lại', () => {
    const nextMorning = loginAt + 20 * HOUR
    expect(checkSession({ loginAt, lastActivity: nextMorning, now: nextMorning }, limits).expired).toBe('max')
  })

  it('Thao tác liên tục vẫn hết phiên sau 12 giờ, báo trước 10 phút', () => {
    const now = loginAt + 12 * HOUR - 8 * MIN
    expect(checkSession({ loginAt, lastActivity: now, now }, limits).warning).toEqual({
      reason: 'max',
      at: loginAt + 12 * HOUR,
    })
  })

  it('Dấu thao tác cũ của phiên trước không làm phiên mới hết hạn', () => {
    const now = loginAt + MIN
    expect(checkSession({ loginAt, lastActivity: loginAt - 3 * 24 * HOUR, now }, limits).expired).toBeNull()
  })

  it('Chưa có dấu thao tác thì tính từ lúc đăng nhập', () => {
    expect(checkSession({ loginAt, lastActivity: null, now: loginAt + 61 * MIN }, limits).expired).toBe(
      'idle',
    )
  })
})
