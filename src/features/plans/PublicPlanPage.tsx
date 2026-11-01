import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Download, Star } from 'lucide-react'
import { PublicPageHeader, PublicQueryState, SidebarBox, WithSidebar } from '@/components/content/PublicPage'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { usePageTitle } from '@/lib/use-page-title'
import { fetchPlanItems, fetchPlans, planFileUrl, planFileViewUrl, PLANS_KEY } from './api'
import { todayInVietnam } from './calendar'
import { PlanCalendar } from './PlanCalendar'

export function PublicPlanPage() {
  usePageTitle('Kế hoạch công tác')
  const [params] = useSearchParams()
  const plans = useQuery({ queryKey: [...PLANS_KEY, 'public'], queryFn: () => fetchPlans(true) })
  const list = plans.data ?? []
  const today = todayInVietnam()
  const thisMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const picked = list.find((p) => p.id === params.get('thang'))
  const plan = picked ?? list.find((p) => p.year === thisMonth.year && p.month === thisMonth.month) ?? list[0]
  const items = useQuery({
    queryKey: [...PLANS_KEY, 'items', plan?.id],
    queryFn: () => fetchPlanItems(plan!.id),
    enabled: Boolean(plan),
  })
  const calendarMonth = picked ? { year: picked.year, month: picked.month } : thisMonth

  return (
    <div>
      <PublicPageHeader title="Kế hoạch công tác" crumbs={[{ label: 'Kế hoạch công tác' }]} />
      <PublicQueryState isPending={plans.isPending} error={plans.error} />
      {plans.data && list.length === 0 && <EmptyState icon={CalendarRange} title="Chưa có kế hoạch" />}
      {plan && (
        <WithSidebar
          sidebar={
            <>
              <PlanCalendar key={`${calendarMonth.year}-${calendarMonth.month}`} initial={calendarMonth} />
              <SidebarBox title="Kế hoạch các tháng">
                <ul className="space-y-1 text-sm">
                  {list.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/ke-hoach?thang=${p.id}`}
                        aria-current={p.id === plan.id ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-primary/10',
                          p.id === plan.id && 'bg-primary/10 font-bold text-primary',
                        )}
                      >
                        <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
                        Tháng {p.month}/{p.year}
                      </Link>
                    </li>
                  ))}
                </ul>
              </SidebarBox>
            </>
          }
        >
          <section className="space-y-4 rounded-xl bg-surface p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold text-primary">{plan.title}</h2>
            {plan.note && <p className="whitespace-pre-line text-sm text-muted">{plan.note}</p>}
            {items.data && items.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary text-left text-white">
                      <th scope="col" className="w-36 p-2.5 font-semibold">
                        Thời gian
                      </th>
                      <th scope="col" className="p-2.5 font-semibold">
                        Nội dung công việc
                      </th>
                      <th scope="col" className="w-48 p-2.5 font-semibold">
                        Bộ phận / người thực hiện
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.data.map((row, i) => (
                      <tr
                        key={i}
                        className={cn('border-b border-border align-top', row.is_important && 'bg-danger/5')}
                      >
                        <td className="whitespace-pre-line p-2.5 font-medium">{row.time_text}</td>
                        <td className="whitespace-pre-line p-2.5">
                          {row.is_important && (
                            <Star
                              className="mr-1 inline h-4 w-4 align-text-bottom text-danger"
                              role="img"
                              aria-label="Sự kiện quan trọng"
                            />
                          )}
                          {row.content}
                        </td>
                        <td className="whitespace-pre-line p-2.5">{row.assignee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {plan.file_path && (
              <>
                <a
                  href={planFileUrl({ file_path: plan.file_path, file_name: plan.file_name })}
                  className={buttonClasses('outline')}
                >
                  <Download className="h-4 w-4" aria-hidden /> Tải file PDF
                </a>
                {items.data?.length === 0 && (
                  <iframe
                    src={planFileViewUrl({ file_path: plan.file_path })}
                    title={`Xem trước: ${plan.title}`}
                    className="h-[75vh] w-full rounded-lg border border-border"
                  />
                )}
              </>
            )}
          </section>
        </WithSidebar>
      )}
    </div>
  )
}
