import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Plus } from 'lucide-react'
import { AdminPageHeader, QueryState, TableCard } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/lib/format'
import {
  asPageStatus,
  asPageTemplate,
  fetchAdminPages,
  PAGE_STATUS_LABELS,
  PAGE_STATUS_TONES,
  PAGE_TEMPLATE_LABELS,
  PAGES_KEY,
} from '../api'

export function PageListPage() {
  const { data, isPending, error } = useQuery({ queryKey: [...PAGES_KEY, 'admin'], queryFn: fetchAdminPages })

  return (
    <div>
      <AdminPageHeader
        title="Trang tĩnh"
        description="Giới thiệu, lịch sử, cơ cấu tổ chức, liên hệ... Gắn vào menu ở mục Menu."
        actions={
          <Link to="/admin/trang/moi" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm trang
          </Link>
        }
      />
      <QueryState isPending={isPending} error={error} />
      {data && data.length === 0 && <EmptyState title="Chưa có trang nào" />}
      {data && data.length > 0 && (
        <TableCard>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Đường dẫn</th>
              <th>Bố cục</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {data.map((page) => {
              const status = asPageStatus(page.status)
              return (
                <tr key={page.id}>
                  <td>
                    <Link
                      to={`/admin/trang/${page.id}`}
                      className="font-semibold hover:text-primary hover:underline"
                    >
                      {page.title}
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/trang/${page.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-muted hover:text-primary"
                    >
                      /trang/{page.slug} <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  </td>
                  <td className="text-muted">{PAGE_TEMPLATE_LABELS[asPageTemplate(page.template)]}</td>
                  <td>
                    <Badge tone={PAGE_STATUS_TONES[status]}>{PAGE_STATUS_LABELS[status]}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(page.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  )
}
