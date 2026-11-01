export interface YearMonth {
  year: number
  month: number
}

export interface PlanEvent {
  content: string
  event_date: string
  event_end_date: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd, không phụ thuộc múi giờ của máy người xem. */
export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** Các tuần của tháng, tuần bắt đầu từ thứ Hai; ô ngoài tháng là null. */
export function monthGrid(target: YearMonth): Array<Array<number | null>> {
  const firstWeekday = new Date(Date.UTC(target.year, target.month - 1, 1)).getUTCDay()
  const leading = (firstWeekday + 6) % 7
  const cells: Array<number | null> = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= daysInMonth(target); day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<number | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Ngày nào trong tháng có sự kiện nào; sự kiện nhiều ngày đánh dấu mọi ngày nằm trong tháng. */
export function eventsByDay<T extends PlanEvent>(events: T[], target: YearMonth): Map<number, T[]> {
  const days = new Map<number, T[]>()
  for (let day = 1; day <= daysInMonth(target); day++) {
    const date = isoDate(target.year, target.month, day)
    const hits = events.filter((e) => e.event_date <= date && date <= (e.event_end_date ?? e.event_date))
    if (hits.length > 0) days.set(day, hits)
  }
  return days
}

/** "20/11" hoặc "03/11 - 14/11". */
export function formatEventDate(event: PlanEvent): string {
  const short = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
  const end = event.event_end_date
  return end && end !== event.event_date
    ? `${short(event.event_date)} - ${short(end)}`
    : short(event.event_date)
}
