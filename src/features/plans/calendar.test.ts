import { describe, expect, it } from 'vitest'
import { eventsByDay, formatEventDate, monthGrid, shiftMonth, todayInVietnam } from './calendar'

describe('monthGrid', () => {
  it('tuần bắt đầu từ thứ Hai, đủ ngày, mỗi hàng 7 ô', () => {
    // 01/11/2026 là Chủ nhật
    const weeks = monthGrid({ year: 2026, month: 11 })
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1])
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
  })

  it('tháng 2 năm nhuận có 29 ngày', () => {
    expect(monthGrid({ year: 2028, month: 2 }).flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('shiftMonth', () => {
  it('qua năm đúng cả hai chiều', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('eventsByDay', () => {
  const single = { content: 'Lễ', event_date: '2026-11-20', event_end_date: null }
  const range = { content: 'Hội giảng', event_date: '2026-10-30', event_end_date: '2026-11-02' }

  it('đánh dấu một ngày và các ngày của sự kiện nhiều ngày trong tháng', () => {
    const days = eventsByDay([single, range], { year: 2026, month: 11 })
    expect([...days.keys()]).toEqual([1, 2, 20])
    expect(days.get(20)).toEqual([single])
  })

  it('sự kiện ở tháng khác không đánh dấu', () => {
    expect(eventsByDay([single], { year: 2026, month: 12 }).size).toBe(0)
  })
})

describe('định dạng', () => {
  it('hiện một ngày hoặc khoảng ngày', () => {
    expect(formatEventDate({ content: '', event_date: '2026-11-20', event_end_date: null })).toBe('20/11')
    expect(formatEventDate({ content: '', event_date: '2026-11-03', event_end_date: '2026-11-14' })).toBe(
      '03/11 - 14/11',
    )
  })

  it('hôm nay tính theo giờ Việt Nam', () => {
    expect(todayInVietnam(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11-01')
  })
})
