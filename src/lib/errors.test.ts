import { describe, expect, it } from 'vitest'
import { toVietnameseError } from './errors'

describe('toVietnameseError', () => {
  it('dịch lỗi đăng nhập sai', () => {
    expect(toVietnameseError(new Error('Invalid login credentials'))).toBe('Email hoặc mật khẩu không đúng.')
  })

  it('dịch lỗi đăng ký email chưa được mời', () => {
    expect(toVietnameseError({ message: 'Database error saving new user' })).toMatch(/chưa được mời/)
  })

  it('giữ nguyên thông báo đã là tiếng Việt từ CSDL', () => {
    expect(toVietnameseError({ message: 'Mã cài đặt không đúng' })).toBe('Mã cài đặt không đúng')
  })

  it('có câu mặc định khi không có nội dung', () => {
    expect(toVietnameseError(null)).toBe('Đã xảy ra lỗi không xác định.')
  })
})
