import { unzipSync } from 'fflate'

export interface PlanRow {
  time_text: string
  content: string
  assignee: string
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Các bảng trong file .docx, mỗi ô là văn bản đã nối các đoạn. Word có bảng lồng thì chỉ lấy bảng ngoài. */
export function readDocxTables(bytes: Uint8Array): string[][][] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' })
  } catch {
    throw new Error('Không đọc được file. Hãy chọn đúng file Word .docx.')
  }
  const xml = files['word/document.xml']
  if (!xml) throw new Error('Không đọc được file. Hãy chọn đúng file Word .docx.')
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml')
  const childrenOf = (el: Element, name: string) =>
    Array.from(el.children).filter((c) => c.namespaceURI === WORD_NS && c.localName === name)
  const body = doc.getElementsByTagNameNS(WORD_NS, 'body')[0]
  if (!body) return []
  return childrenOf(body, 'tbl').map((table) =>
    childrenOf(table, 'tr').map((row) =>
      childrenOf(row, 'tc').map((cell) =>
        childrenOf(cell, 'p')
          .map((p) =>
            Array.from(p.getElementsByTagNameNS(WORD_NS, 't'))
              .map((t) => t.textContent ?? '')
              .join(''),
          )
          .filter((line) => line.trim())
          .join('\n')
          .trim(),
      ),
    ),
  )
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

const COLUMN_HINTS = {
  time_text: /thoi gian|ngay|tuan|thang/,
  content: /noi dung|cong viec|hoat dong/,
  assignee: /bo phan|nguoi|phu trach|thuc hien/,
}

/**
 * Chọn bảng có tiêu đề cột khớp nhất rồi chuyển thành các hàng kế hoạch.
 * Không nhận ra tiêu đề thì coi 3 cột (bỏ cột số thứ tự nếu có) là thời gian, nội dung, người thực hiện.
 */
export function tablesToPlanRows(tables: string[][][]): PlanRow[] {
  let best: { table: string[][]; columns: Record<keyof PlanRow, number>; hasHeader: boolean } | null = null
  let bestScore = -1
  for (const table of tables) {
    const header = (table[0] ?? []).map(normalize)
    if (header.length < 2) continue
    const find = (pattern: RegExp) => header.findIndex((h) => pattern.test(h))
    // Tìm nội dung trước: "Nội dung công việc" không được lẫn sang cột khác
    const content = find(COLUMN_HINTS.content)
    const others = (pattern: RegExp) => header.findIndex((h, i) => i !== content && pattern.test(h))
    const time = others(COLUMN_HINTS.time_text)
    const assignee = others(COLUMN_HINTS.assignee)
    const score = [content, time, assignee].filter((i) => i >= 0).length
    if (score > bestScore && (score >= 2 || bestScore < 0)) {
      bestScore = score
      if (score >= 2) {
        best = { table, columns: { time_text: time, content, assignee }, hasHeader: true }
      } else {
        const skip =
          /^(stt|tt|so tt)\.?$/.test(header[0]!.trim()) || /^\d+\.?$/.test(header[0]!.trim()) ? 1 : 0
        best = {
          table,
          columns: { time_text: skip, content: skip + 1, assignee: skip + 2 },
          hasHeader: /^(stt|tt|so tt)\.?$/.test(header[0]!.trim()),
        }
      }
    }
  }
  if (!best) return []
  const { table, columns, hasHeader } = best
  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '')
  return table
    .slice(hasHeader ? 1 : 0)
    .map((row) => ({
      time_text: cell(row, columns.time_text),
      content: cell(row, columns.content),
      assignee: cell(row, columns.assignee),
    }))
    .filter((r) => r.content)
}

export async function parseDocxPlan(file: File): Promise<PlanRow[]> {
  return tablesToPlanRows(readDocxTables(new Uint8Array(await file.arrayBuffer())))
}
