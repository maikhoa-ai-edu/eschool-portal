import { Link, useSearchParams } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPage'
import { cn } from '@/lib/cn'
import { CounterTab } from './CounterTab'
import { LayoutTab } from './LayoutTab'
import { MarqueeTab } from './MarqueeTab'
import { SlidesTab } from './SlidesTab'

const TABS = [
  { key: 'slide', label: 'Slide', Component: SlidesTab },
  { key: 'bo-cuc', label: 'Bố cục', Component: LayoutTab },
  { key: 'chu-chay', label: 'Dòng chữ chạy', Component: MarqueeTab },
  { key: 'bo-dem', label: 'Bộ đếm truy cập', Component: CounterTab },
] as const

export function HomepageAdminPage() {
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]

  return (
    <div>
      <AdminPageHeader
        title="Trang chủ"
        description="Slide, thứ tự các khối, dòng chữ chạy và bộ đếm truy cập. Lưu xong trang công khai đổi ngay."
        actions={
          <Link
            to="/"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Xem trang chủ <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />
      <div role="tablist" aria-label="Cấu hình trang chủ" className="mb-5 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active.key}
            onClick={() => setParams({ tab: tab.key }, { replace: true })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              tab.key === active.key ? 'bg-primary text-white' : 'bg-surface hover:bg-bg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={active.label}>
        <active.Component />
      </div>
    </div>
  )
}
