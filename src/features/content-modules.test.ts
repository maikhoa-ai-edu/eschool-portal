import { describe, expect, it } from 'vitest'
import { moveItem } from './albums/api'
import { isExpired } from './announcements/api'
import { describeDocumentProblem, documentExtension, toSearchQuery } from './documents/api'
import { baseName, describeImageProblem, fitWithin } from './media/api'
import { MENU_URL_PATTERN } from './menus/api'
import { actionLabel, newsWorkflow, parseTags, targetStatus } from './news/workflow'

describe('quy trình tin tức', () => {
  const editor = { canPublish: false, canEditAny: false, isAuthor: true }
  const admin = { canPublish: true, canEditAny: true, isAuthor: false }

  it('biên tập viên: lưu nháp hoặc gửi duyệt, không có nút đăng', () => {
    expect(newsWorkflow(null, editor).actions).toEqual(['save_draft', 'submit'])
    expect(newsWorkflow('draft', editor).actions).toEqual(['save_draft', 'submit'])
    expect(newsWorkflow('pending', editor).actions).toEqual(['save', 'withdraw'])
  })
  it('biên tập viên không sửa được bài đã đăng hoặc bài của người khác', () => {
    expect(newsWorkflow('published', editor)).toEqual({ editable: false, actions: [] })
    expect(newsWorkflow('draft', { ...editor, isAuthor: false }).editable).toBe(false)
  })
  it('người duyệt: duyệt/trả lại bài chờ duyệt, gỡ bài đã đăng, đăng lại bài đã gỡ', () => {
    expect(newsWorkflow('pending', admin).actions).toEqual(['save', 'reject', 'publish'])
    expect(newsWorkflow('published', admin).actions).toEqual(['save', 'unpublish'])
    expect(newsWorkflow('archived', admin).actions).toEqual(['save', 'publish'])
  })
  it('trạng thái đích và nhãn nút theo ngữ cảnh', () => {
    expect(targetStatus('reject', 'pending')).toBe('draft')
    expect(targetStatus('save', 'pending')).toBe('pending')
    expect(targetStatus('save', null)).toBe('draft')
    expect(actionLabel('publish', 'pending')).toBe('Duyệt & đăng')
    expect(actionLabel('publish', 'archived')).toBe('Đăng lại')
  })
  it('tách thẻ, bỏ trùng không phân biệt hoa thường', () => {
    expect(parseTags(' Khai giảng, khai giảng ,  học   sinh giỏi,,')).toEqual(['Khai giảng', 'học sinh giỏi'])
  })
})

describe('văn bản', () => {
  it('chỉ nhận PDF/Office, tối đa 25 MB', () => {
    expect(describeDocumentProblem({ name: 'KH.PDF', size: 1000 })).toBeNull()
    expect(describeDocumentProblem({ name: 'bieu-mau.docx', size: 1000 })).toBeNull()
    expect(describeDocumentProblem({ name: 'virus.exe', size: 1000 })).toMatch(/Chỉ nhận/)
    expect(describeDocumentProblem({ name: 'a.pdf', size: 26 * 1024 * 1024 })).toMatch(/quá lớn/)
  })
  it('phần mở rộng và truy vấn tìm kiếm không dấu', () => {
    expect(documentExtension('Quyết định 12.xlsx')).toBe('xlsx')
    expect(documentExtension('khong-duoi')).toBe('')
    expect(toSearchQuery(' Kế hoạch Tuyển sinh ')).toBe('ke hoach tuyen sinh')
  })
})

describe('ảnh', () => {
  it('thu nhỏ giữ tỉ lệ, không phóng to ảnh nhỏ', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 })
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 })
  })
  it('kiểm tra định dạng và tên mặc định', () => {
    expect(describeImageProblem(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull()
    expect(describeImageProblem(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(/Chỉ nhận/)
    expect(baseName('Hội trại 2026.JPG')).toBe('Hội trại 2026')
  })
  it('đổi chỗ ảnh liền kề, giữ nguyên khi ra ngoài biên', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
})

describe('thông báo & menu', () => {
  it('thông báo quá hạn', () => {
    const now = new Date('2026-10-30T00:00:00Z')
    expect(isExpired({ status: 'published', expires_at: '2026-10-29T00:00:00Z' }, now)).toBe(true)
    expect(isExpired({ status: 'published', expires_at: null }, now)).toBe(false)
    expect(isExpired({ status: 'draft', expires_at: '2026-10-29T00:00:00Z' }, now)).toBe(false)
  })
  it('đường dẫn menu khớp ràng buộc CSDL', () => {
    expect(MENU_URL_PATTERN.test('/trang/gioi-thieu')).toBe(true)
    expect(MENU_URL_PATTERN.test('https://moet.gov.vn')).toBe(true)
    expect(MENU_URL_PATTERN.test('javascript:alert(1)')).toBe(false)
    expect(MENU_URL_PATTERN.test('trang/gioi-thieu')).toBe(false)
  })
})
