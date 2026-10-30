import { useState } from 'react'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import { niceAxisMax, shortDay, type VisitDay } from './visits'

/** Biểu đồ cột lượt truy cập theo ngày: một chuỗi màu chính của trường, rê/chạm vào cột để xem số. */
export function VisitsChart({ days }: { days: VisitDay[] }) {
  const [active, setActive] = useState<number | null>(null)
  const peak = days.reduce((max, d) => Math.max(max, d.visits), 0)
  const axisMax = niceAxisMax(peak)
  const activeDay = active === null ? null : days[active]
  // Nhãn trục cách đều, luôn có ngày cuối
  const labelEvery = Math.ceil(days.length / 5)
  const showLabel = (i: number) => (days.length - 1 - i) % labelEvery === 0

  return (
    <div>
      <div className="flex gap-2">
        <div
          className="flex h-44 w-9 shrink-0 flex-col justify-between text-right text-xs text-muted"
          aria-hidden
        >
          <span>{formatNumber(axisMax)}</span>
          <span>{formatNumber(axisMax / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`Biểu đồ lượt truy cập ${days.length} ngày gần nhất, cao nhất ${formatNumber(peak)} lượt một ngày`}
            className="relative h-44 border-b border-border"
            onMouseLeave={() => setActive(null)}
          >
            <div className="absolute inset-x-0 top-0 border-t border-border" aria-hidden />
            <div className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden />
            <div className="relative flex h-full gap-0.5">
              {days.map((d, i) => (
                <div
                  key={d.day}
                  data-testid="visit-bar"
                  className="flex h-full min-w-0 flex-1 items-end justify-center"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <div
                    className={cn(
                      'w-full max-w-6 rounded-t bg-primary transition-opacity',
                      active !== null && active !== i && 'opacity-40',
                    )}
                    style={{ height: `${(d.visits / axisMax) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            {activeDay && active !== null && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
                style={
                  active < days.length / 2
                    ? { left: `${((active + 1) / days.length) * 100}%`, marginLeft: 6 }
                    : { right: `${((days.length - active) / days.length) * 100}%`, marginRight: 6 }
                }
              >
                <span className="block text-muted">{formatDate(activeDay.day)}</span>
                <span className="block font-semibold text-text">{formatNumber(activeDay.visits)} lượt</span>
              </div>
            )}
          </div>
          <div className="mt-1 flex gap-0.5 text-xs text-muted" aria-hidden>
            {days.map((d, i) => (
              <div key={d.day} className="relative h-4 min-w-0 flex-1">
                {showLabel(i) && (
                  <span className="absolute right-0 whitespace-nowrap">{shortDay(d.day)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Xem bảng số liệu</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-1.5">
            <thead className="sticky top-0 bg-bg text-xs text-muted">
              <tr>
                <th>Ngày</th>
                <th className="text-right">Lượt truy cập</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td>{formatDate(d.day)}</td>
                  <td className="text-right tabular-nums">{formatNumber(d.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
