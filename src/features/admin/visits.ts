export interface VisitDay {
  /** yyyy-mm-dd theo giờ Việt Nam */
  day: string
  visits: number
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

/** Ngày hiện tại theo giờ Việt Nam, cùng cách tính với record_visit trong CSDL. */
export function vietnamToday(now = new Date()): string {
  return dayFormat.format(now)
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** CSDL chỉ có dòng cho ngày có lượt truy cập; ngày trống phải hiện cột 0 để trục thời gian không bị dồn. */
export function fillVisitDays(rows: readonly VisitDay[], today: string, count: number): VisitDay[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.visits)]))
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i - count + 1)
    return { day, visits: byDay.get(day) ?? 0 }
  })
}

/** Mốc trên cùng của trục dọc: số tròn 1/2/5 × 10^n, không nhỏ hơn giá trị lớn nhất. */
export function niceAxisMax(max: number): number {
  if (max <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= max) ?? 10
  return step * magnitude
}

/** dd/mm cho nhãn trục, không đi qua Date để khỏi lệch múi giờ. */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}
