import { describe, expect, it } from 'vitest'
import { clearInstallDraft, readInstallDraft, updateInstallDraft } from '@/lib/install-draft'
import {
  classifySchemaProbe,
  dashboardLink,
  describeKeyProblem,
  describeLogoProblem,
  normalizeSupabaseUrl,
} from './api'
import { REQUIRED_SCHEMA_VERSION } from '@/lib/version'
import { adjustLightness, COLOR_PRESETS, contrastRatio } from './color'

function jwt(payload: object): string {
  const part = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${part({ alg: 'HS256' })}.${part(payload)}.chu-ky-gia-lap`
}

describe('normalizeSupabaseUrl', () => {
  it('bỏ dấu / cuối và phần đường dẫn thừa', () => {
    expect(normalizeSupabaseUrl(' https://abcdefghijklmnopqrst.supabase.co/rest/v1/ ')).toBe(
      'https://abcdefghijklmnopqrst.supabase.co',
    )
  })
  it('chỉ cho http với máy cục bộ', () => {
    expect(normalizeSupabaseUrl('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321')
    expect(normalizeSupabaseUrl('http://abc.supabase.co')).toBeNull()
    expect(normalizeSupabaseUrl('khong-phai-url')).toBeNull()
  })
})

describe('describeKeyProblem', () => {
  it('nhận khóa anon và publishable', () => {
    expect(describeKeyProblem(jwt({ role: 'anon' }))).toBeNull()
    expect(describeKeyProblem('sb_publishable_abcdefghijklmnopqrstuv')).toBeNull()
  })
  it('chặn khóa bí mật', () => {
    expect(describeKeyProblem(jwt({ role: 'service_role' }))).toMatch(/khóa bí mật/)
    expect(describeKeyProblem('sb_secret_abcdefghijklmnopqrstuv')).toMatch(/khóa bí mật/)
  })
  it('chặn chuỗi rác', () => {
    expect(describeKeyProblem('ngắn quá')).toMatch(/không hợp lệ/)
  })
})

describe('classifySchemaProbe', () => {
  it('CSDL trống khi chưa có hàm get_schema_version', () => {
    expect(classifySchemaProbe(null, { code: 'PGRST202', message: 'Could not find the function' })).toEqual({
      kind: 'empty',
    })
  })
  it('đúng / lệch phiên bản', () => {
    expect(classifySchemaProbe(REQUIRED_SCHEMA_VERSION, null)).toEqual({
      kind: 'ready',
      version: REQUIRED_SCHEMA_VERSION,
    })
    expect(classifySchemaProbe('0.1.0', null)).toEqual({ kind: 'outdated', version: '0.1.0' })
  })
  it('dịch lỗi khóa sai và lỗi mạng', () => {
    expect(classifySchemaProbe(null, { message: 'Invalid API key' })).toMatchObject({
      kind: 'error',
      message: expect.stringMatching(/Khóa anon/),
    })
    expect(classifySchemaProbe(null, { message: 'TypeError: Failed to fetch' })).toMatchObject({
      message: expect.stringMatching(/Không kết nối được/),
    })
  })
})

describe('dashboardLink', () => {
  it('dựng liên kết SQL Editor cho project trên cloud', () => {
    expect(dashboardLink('https://abcdefghijklmnopqrst.supabase.co', 'sql/new')).toBe(
      'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/sql/new',
    )
    expect(dashboardLink('http://127.0.0.1:54321', 'sql/new')).toBe('https://supabase.com/dashboard')
  })
})

describe('describeLogoProblem', () => {
  it('chỉ nhận ảnh raster nhỏ hơn 2 MB (không nhận SVG)', () => {
    expect(describeLogoProblem(new File(['x'], 'logo.png', { type: 'image/png' }))).toBeNull()
    expect(describeLogoProblem(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))).toMatch(/PNG/)
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })
    expect(describeLogoProblem(big)).toMatch(/quá lớn/)
  })
})

describe('màu sắc', () => {
  it('màu phụ sáng hơn màu chủ đạo một chút', () => {
    expect(adjustLightness('#002B66', 8)).toBe('#003c8f')
    expect(adjustLightness('#ffffff', 8)).toBe('#ffffff')
  })
  it('các bộ màu gợi ý đủ tương phản với chữ trắng', () => {
    for (const preset of COLOR_PRESETS) {
      expect(contrastRatio(preset.primary, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio('#ffff00', '#ffffff')).toBeLessThan(2)
  })
})

describe('bản nháp cài đặt', () => {
  it('lưu, gộp và xóa; bỏ qua dữ liệu hỏng', () => {
    clearInstallDraft()
    expect(readInstallDraft()).toEqual({})
    updateInstallDraft({ step: 3 })
    updateInstallDraft({
      connection: { supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(30) },
    })
    expect(readInstallDraft()).toMatchObject({
      step: 3,
      connection: { supabaseUrl: 'https://abc.supabase.co' },
    })

    localStorage.setItem(
      'eschool:install-draft',
      JSON.stringify({ step: 99, connection: { supabaseUrl: 'js:x' } }),
    )
    expect(readInstallDraft()).toEqual({})
    localStorage.setItem('eschool:install-draft', '{hỏng')
    expect(readInstallDraft()).toEqual({})
    clearInstallDraft()
  })
})
