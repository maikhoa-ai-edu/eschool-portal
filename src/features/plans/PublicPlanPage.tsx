import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Download } from 'lucide-react'
import { PublicPageHeader, PublicQueryState } from '@/components/content/PublicPage'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePageTitle } from '@/lib/use-page-title'
import { fetchPlanItems, fetchPlans, planFileUrl, planFileViewUrl, PLANS_KEY } from './api'

export function PublicPlanPage() {
  usePageTitle('Kế hoạch công tác')
  const [params, setParams] = useSearchParams()
  const plans = useQuery({ queryKey: [...PLANS_KEY, 'public'], queryFn: () => fetchPlans(true) })
  const list = plans.data ?? []
  const plan = list.find((p) => p.id === params.get('thang')) ?? list[0]
  const items = useQuery({
    queryKey: [...PLANS_KEY, 'items', plan?.id],
    queryFn: () => fetchPlanItems(plan!.id),
    enabled: Boolean(plan),
  })

  return (
    <div>
      <PublicPageHeader title="Kế hoạch công tác" crumbs={[{ label: 'Kế hoạch công tác' }]} />
      <PublicQueryState isPending={plans.isPending} error={plans.error} />
      {plans.data && list.length === 0 && <EmptyState icon={CalendarRange} title="Chưa có kế hoạch" />}
      {plan && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            Tháng
            <select
              value={plan.id}
              onChange={(e) => setParams({ thang: e.target.value })}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-normal"
            >
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  Tháng {p.month}/{p.year}
                </option>
              ))}
            </select>
          </label>
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
                      <tr key={i} className="border-b border-border align-top">
                        <td className="whitespace-pre-line p-2.5 font-medium">{row.time_text}</td>
                        <td className="whitespace-pre-line p-2.5">{row.content}</td>
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
        </div>
      )}
    </div>
  )
}
