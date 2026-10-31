import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readDocxTables, tablesToPlanRows } from './docx'

function docx(...rows: string[][]): Uint8Array {
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Tiêu đề</w:t></w:r></w:p><w:tbl>${rows
    .map((r) => `<w:tr>${r.map(cell).join('')}</w:tr>`)
    .join('')}</w:tbl></w:body></w:document>`
  return zipSync({ 'word/document.xml': strToU8(xml) })
}

describe('đọc kế hoạch từ Word', () => {
  it('nhận cột theo tiêu đề, bỏ cột STT và hàng không có nội dung', () => {
    const tables = readDocxTables(
      docx(
        ['STT', 'Thời gian', 'Nội dung công việc', 'Bộ phận thực hiện'],
        ['1', '02/11', 'Họp hội đồng', 'Ban giám hiệu'],
        ['2', '', '', ''],
        ['3', 'Tuần 2', 'Kiểm tra nội bộ', 'Tổ chuyên môn'],
      ),
    )
    expect(tablesToPlanRows(tables)).toEqual([
      { time_text: '02/11', content: 'Họp hội đồng', assignee: 'Ban giám hiệu' },
      { time_text: 'Tuần 2', content: 'Kiểm tra nội bộ', assignee: 'Tổ chuyên môn' },
    ])
  })

  it('cột đổi thứ tự vẫn đúng', () => {
    expect(
      tablesToPlanRows([
        [
          ['Nội dung', 'Người phụ trách', 'Ngày'],
          ['Sinh hoạt lớp', 'GVCN', '05/11'],
        ],
      ]),
    ).toEqual([{ time_text: '05/11', content: 'Sinh hoạt lớp', assignee: 'GVCN' }])
  })

  it('không có tiêu đề: coi 3 cột theo thứ tự thời gian, nội dung, người thực hiện', () => {
    expect(tablesToPlanRows([[['05/11', 'Họp', 'BGH']]])).toEqual([
      { time_text: '05/11', content: 'Họp', assignee: 'BGH' },
    ])
  })

  it('file không phải docx báo lỗi rõ ràng, file không có bảng trả rỗng', () => {
    expect(() => readDocxTables(strToU8('không phải zip'))).toThrow('Word .docx')
    expect(tablesToPlanRows([])).toEqual([])
  })
})
