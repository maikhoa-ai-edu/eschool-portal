/** Số trang hiển thị: luôn có trang đầu, cuối và 1 trang mỗi bên trang hiện tại; null = dấu "…". */
export function pageWindow(current: number, total: number): Array<number | null> {
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: Array<number | null> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) result.push(null)
    result.push(p)
  })
  return result
}

/** Đọc ?trang= (số nguyên dương, mặc định 1). */
export function readPage(search: URLSearchParams): number {
  const page = Number(search.get('trang'))
  return Number.isInteger(page) && page > 0 ? page : 1
}

/** Khoảng bản ghi cho .range() của Supabase (hai đầu đều tính). */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize
  return [from, from + pageSize - 1]
}
