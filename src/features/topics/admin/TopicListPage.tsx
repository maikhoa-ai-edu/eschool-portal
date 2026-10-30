import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { AdminPageHeader, QueryState } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { asPageStatus, PAGE_STATUS_LABELS, PAGE_STATUS_TONES } from '@/features/pages/api'
import { formatDate } from '@/lib/format'
import { fetchAdminTopics, TOPICS_KEY } from '../api'

export function TopicListPage() {
  const { data, isPending, error } = useQuery({
    queryKey: [...TOPICS_KEY, 'admin'],
    queryFn: fetchAdminTopics,
  })
  return (
    <div>
      <AdminPageHeader
        title="Chuyên đề"
        description="Trang chuyên đề dạng giới thiệu: phần đầu trang và các khối nội dung tự sắp xếp."
        actions={
          <Link
            to="/admin/chuyen-de/moi"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-light"
          >
            <Plus className="h-4 w-4" aria-hidden /> Thêm chuyên đề
          </Link>
        }
      />
      <QueryState isPending={isPending} error={error} />
      {data &&
        (data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Chưa có chuyên đề nào.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {data.map((t) => {
              const status = asPageStatus(t.status)
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/chuyen-de/${t.id}`} className="font-semibold hover:text-primary">
                      {t.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      /chuyen-de/{t.slug} · Sửa {formatDate(t.updated_at)}
                    </p>
                  </div>
                  <Badge tone={PAGE_STATUS_TONES[status]}>{PAGE_STATUS_LABELS[status]}</Badge>
                </li>
              )
            })}
          </ul>
        ))}
    </div>
  )
}
