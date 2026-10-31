import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Star } from 'lucide-react'
import { AdminPageHeader, QueryState, TableCard } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { useAuth } from '@/features/auth/auth-context'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ADMIN_PAGE_SIZE, fetchAdminNews, NEWS_KEY } from '../api'
import { NewsListStylePanel } from './NewsListStylePanel'
import {
  isNewsStatus,
  NEWS_STATUS_LABELS,
  NEWS_STATUS_TONES,
  NEWS_STATUSES,
  type NewsStatus,
} from '../workflow'

const TABS: Array<{ value: NewsStatus | null; label: string }> = [
  { value: null, label: 'Tất cả' },
  ...NEWS_STATUSES.map((s) => ({ value: s, label: NEWS_STATUS_LABELS[s] })),
]

export function NewsListPage() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('trang-thai')
  const status = isNewsStatus(statusParam) ? statusParam : null
  const query = params.get('q') ?? ''
  const page = readPage(params)
  const [draftQuery, setDraftQuery] = useState(query)

  const { data, isPending, error } = useQuery({
    queryKey: [...NEWS_KEY, 'admin', { status, query, page }],
    queryFn: () => fetchAdminNews({ status, query, page }),
  })

  const setFilter = (next: { status?: NewsStatus | null; q?: string }) => {
    const p = new URLSearchParams(params)
    p.delete('trang')
    if (next.status !== undefined) {
      if (next.status) p.set('trang-thai', next.status)
      else p.delete('trang-thai')
    }
    if (next.q !== undefined) {
      if (next.q) p.set('q', next.q)
      else p.delete('q')
    }
    setParams(p)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    setFilter({ q: draftQuery.trim() })
  }

  return (
    <div>
      <NewsListStylePanel />
      <AdminPageHeader
        title="Tin tức"
        description={
          can('news.edit_any')
            ? 'Toàn bộ bài viết của nhà trường.'
            : 'Bài viết của bạn và các bài đã đăng. Bài gửi duyệt sẽ được quản trị viên xem xét.'
        }
        actions={
          <Link to="/admin/tin-tuc/moi" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Viết bài mới
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.value === status}
              onClick={() => setFilter({ status: tab.value })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                tab.value === status ? 'bg-primary text-white' : 'bg-surface text-text hover:bg-bg',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <input
            type="search"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề..."
            aria-label="Tìm theo tiêu đề"
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm lg:w-64"
          />
          <button type="submit" className={buttonClasses('outline', 'sm', 'h-9')} aria-label="Tìm">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <QueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && (
        <EmptyState title="Chưa có bài viết nào">
          {status || query ? 'Không có bài phù hợp bộ lọc.' : 'Bấm "Viết bài mới" để bắt đầu.'}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <TableCard>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Chuyên mục</th>
                <th>Tác giả</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const itemStatus = item.status as NewsStatus
                return (
                  <tr key={item.id}>
                    <td className="max-w-md">
                      <Link
                        to={`/admin/tin-tuc/${item.id}`}
                        className="font-semibold text-text hover:text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.is_featured && (
                        <Star
                          className="ml-1.5 inline h-3.5 w-3.5 fill-accent text-accent"
                          aria-label="Nổi bật"
                        />
                      )}
                    </td>
                    <td className="text-muted">{item.category?.name}</td>
                    <td className="text-muted">{item.author?.full_name}</td>
                    <td>
                      <Badge tone={NEWS_STATUS_TONES[itemStatus]}>{NEWS_STATUS_LABELS[itemStatus]}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(item.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </TableCard>
          <Pagination page={page} totalPages={Math.ceil(data.total / ADMIN_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}
