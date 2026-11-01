import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { SidebarBox } from '@/components/content/PublicPage'
import { cn } from '@/lib/cn'
import { fetchMonthEvents, PLANS_KEY } from './api'
import {
  eventsByDay,
  formatEventDate,
  isoDate,
  monthGrid,
  shiftMonth,
  todayInVietnam,
  type YearMonth,
} from './calendar'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Lịch tháng ở cột phải, đánh dấu các ngày có sự kiện quan trọng của kế hoạch đã đăng. */
export function PlanCalendar({ initial }: { initial: YearMonth }) {
  const [target, setTarget] = useState(initial)
  const { data = [] } = useQuery({
    queryKey: [...PLANS_KEY, 'events', target.year, target.month],
    queryFn: () => fetchMonthEvents(target),
  })
  const days = eventsByDay(data, target)
  const today = todayInVietnam()
  const nav = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg'

  return (
    <SidebarBox title={`Lịch tháng ${target.month}/${target.year}`}>
      <div className="mb-2 flex justify-between">
        <button
          type="button"
          className={nav}
          aria-label="Tháng trước"
          onClick={() => setTarget(shiftMonth(target, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={nav}
          aria-label="Tháng sau"
          onClick={() => setTarget(shiftMonth(target, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <table className="w-full table-fixed text-center text-sm">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 text-xs font-semibold text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(target).map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => {
                const events = day ? days.get(day) : undefined
                const isToday = day !== null && isoDate(target.year, target.month, day) === today
                return (
                  <td key={d} className="p-0.5">
                    {day && (
                      <span
                        title={events?.map((e) => e.content).join('; ')}
                        aria-current={isToday ? 'date' : undefined}
                        className={cn(
                          'mx-auto flex h-8 w-8 items-center justify-center rounded-full',
                          events && 'bg-danger font-bold text-white',
                          isToday && 'ring-2 ring-primary ring-offset-1',
                        )}
                      >
                        {day}
                        {events && <span className="sr-only"> (có sự kiện quan trọng)</span>}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mb-2 mt-4 flex items-center gap-1.5 text-sm font-bold">
        <Star className="h-4 w-4 text-danger" aria-hidden /> Sự kiện quan trọng
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted">Tháng này chưa có sự kiện được đánh dấu.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {data.map((event, i) => (
            <li key={i}>
              <span className="block text-xs font-semibold text-danger">{formatEventDate(event)}</span>
              <span className="font-medium leading-snug">{event.content}</span>
            </li>
          ))}
        </ul>
      )}
    </SidebarBox>
  )
}
