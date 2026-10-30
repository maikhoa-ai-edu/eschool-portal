import { describe, expect, it } from 'vitest'
import { invitationLink, invitationMailto, invitationState } from './accounts/api'
import { fillVisitDays, niceAxisMax, shortDay, vietnamToday } from './admin/visits'
import { auditFieldLabels, auditTarget, auditTimeRange } from './audit/api'
import { checkAuthSettings, checkHealth, checkSchemaVersion, type SystemHealth } from './system/checks'

describe('lời mời', () => {
  const now = new Date('2026-10-30T00:00:00Z')

  it('phân biệt đang mở, hết hạn, đã nhận', () => {
    expect(invitationState({ accepted_at: null, expires_at: '2026-11-01T00:00:00Z' }, now)).toBe('open')
    expect(invitationState({ accepted_at: null, expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('expired')
    expect(
      invitationState({ accepted_at: '2026-10-02T00:00:00Z', expires_at: '2026-10-01T00:00:00Z' }, now),
    ).toBe('accepted')
  })

  it('mã hóa email trong liên kết', () => {
    expect(invitationLink('a+b@x.vn', 'https://truong.vn')).toBe(
      'https://truong.vn/dang-ky?email=a%2Bb%40x.vn',
    )
  })

  it('thư soạn sẵn có liên kết mời', () => {
    const mailto = invitationMailto('gv@x.vn', 'Trường A', 'https://truong.vn')
    expect(mailto.startsWith('mailto:gv%40x.vn?subject=')).toBe(true)
    expect(decodeURIComponent(mailto)).toContain('https://truong.vn/dang-ky?email=gv%40x.vn')
  })
})

describe('biểu đồ truy cập', () => {
  it('ngày hiện tại tính theo giờ Việt Nam', () => {
    expect(vietnamToday(new Date('2026-10-30T18:00:00Z'))).toBe('2026-10-31')
  })

  it('điền 0 cho ngày trống, kể cả qua đầu tháng', () => {
    expect(fillVisitDays([{ day: '2026-11-01', visits: 5 }], '2026-11-02', 3)).toEqual([
      { day: '2026-10-31', visits: 0 },
      { day: '2026-11-01', visits: 5 },
      { day: '2026-11-02', visits: 0 },
    ])
  })

  it('mốc trục dọc là số tròn, không nhỏ hơn giá trị lớn nhất', () => {
    expect(niceAxisMax(0)).toBe(10)
    expect(niceAxisMax(7)).toBe(10)
    expect(niceAxisMax(168)).toBe(200)
    expect(niceAxisMax(200)).toBe(200)
    expect(niceAxisMax(201)).toBe(500)
  })

  it('nhãn ngày dạng dd/mm', () => {
    expect(shortDay('2026-11-02')).toBe('02/11')
  })
})

describe('nhật ký', () => {
  it('lọc theo giờ Việt Nam và tính hết ngày cuối', () => {
    expect(auditTimeRange('2026-10-01', '2026-10-31')).toEqual({
      gte: '2026-09-30T17:00:00.000Z',
      lt: '2026-10-31T17:00:00.000Z',
    })
    expect(auditTimeRange('', '')).toEqual({})
  })

  it('dịch khóa cấu hình, không đụng tới tiêu đề bài viết', () => {
    expect(auditTarget({ table_name: 'site_settings', summary: 'branding' })).toBe('Cấu hình: Nhận diện')
    expect(auditTarget({ table_name: 'news', summary: 'albums' })).toBe('Tin tức: albums')
  })

  it('dịch tên trường, giữ nguyên trường chưa biết', () => {
    expect(auditFieldLabels(['role', 'cot_moi'])).toBe('vai trò, cot_moi')
    expect(auditFieldLabels(null)).toBe('')
  })
})

describe('kiểm tra hệ thống', () => {
  const health: SystemHealth = {
    database_size: 1024,
    install_completed: true,
    buckets: [
      { id: 'documents', public: true, file_count: 1, total_size: 10 },
      { id: 'media', public: true, file_count: 2, total_size: 20 },
    ],
    tables_without_rls: [],
    accounts: { active: 3, locked: 0, super_admins: 2 },
    invitations: { open: 1, expired: 0 },
    modules: { enabled: 5, total: 5 },
    audit: { total: 10, last_at: null },
  }
  const statusOf = (h: SystemHealth, label: string) => checkHealth(h).find((c) => c.label === label)?.status

  it('báo lỗi khi lệch phiên bản schema', () => {
    expect(checkSchemaVersion('0.5.0', '0.5.0').status).toBe('ok')
    expect(checkSchemaVersion('0.4.0', '0.5.0').status).toBe('error')
  })

  it('báo lỗi khi tắt đăng ký, cảnh báo khi tắt xác nhận email', () => {
    const [signup, confirm] = checkAuthSettings({ disable_signup: true, mailer_autoconfirm: true })
    expect(signup?.status).toBe('error')
    expect(confirm?.status).toBe('warning')
  })

  it('hệ thống bình thường không có lỗi', () => {
    expect(checkHealth(health).filter((c) => c.status === 'error' || c.status === 'warning')).toEqual([])
  })

  it('phát hiện bảng thiếu RLS, thiếu bucket, thiếu quản trị viên', () => {
    expect(statusOf({ ...health, tables_without_rls: ['x'] }, 'Bảo vệ dữ liệu (RLS)')).toBe('error')
    expect(statusOf({ ...health, buckets: health.buckets.slice(0, 1) }, 'Kho lưu trữ')).toBe('error')
    expect(
      statusOf({ ...health, accounts: { ...health.accounts, super_admins: 1 } }, 'Quản trị viên cấp cao'),
    ).toBe('warning')
  })
})
