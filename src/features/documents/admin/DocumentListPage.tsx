import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { AdminPageHeader, QueryState, TableCard } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { formatDate, formatNumber } from '@/lib/format'
import {
  asDocumentStatus,
  DOCUMENT_PAGE_SIZE,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  DOCUMENTS_KEY,
  documentTypeLabel,
  fetchAdminDocuments,
  isDocumentType,
} from '../api'

export function DocumentListPage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params)
  const typeParam = params.get('loai')
  const type = isDocumentType(typeParam) ? typeParam : null
  const query = params.get('q') ?? ''
  const [draft, setDraft] = useState(query)

  const { data, isPending, error } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'admin', { page, type, query }],
    queryFn: () => fetchAdminDocuments({ page, type, query }),
  })

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params)
    p.delete('trang')
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p)
  }

  return (
    <div>
      <AdminPageHeader
        title="Văn bản"
        description="Kế hoạch, quyết định, công văn, biểu mẫu... công khai cho phụ huynh và giáo viên tải về."
        actions={
          <Link to="/admin/van-ban/moi" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm văn bản
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Lọc theo loại văn bản"
          value={type ?? ''}
          onChange={(e) => update('loai', e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Tất cả loại</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <form
          role="search"
          className="flex flex-1 gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            update('q', draft.trim())
          }}
        >
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tìm theo tên, số hiệu, người ký..."
            aria-label="Tìm văn bản"
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm sm:max-w-sm"
          />
          <button type="submit" className={buttonClasses('outline', 'sm', 'h-9')} aria-label="Tìm">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <QueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState title="Chưa có văn bản nào" />}
      {data && data.items.length > 0 && (
        <>
          <TableCard>
            <thead>
              <tr>
                <th>Số hiệu</th>
                <th>Tên văn bản</th>
                <th>Loại</th>
                <th>Ngày ban hành</th>
                <th>Trạng thái</th>
                <th className="text-right">Lượt tải</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((doc) => {
                const status = asDocumentStatus(doc.status)
                return (
                  <tr key={doc.id}>
                    <td className="whitespace-nowrap text-muted">{doc.document_number ?? '—'}</td>
                    <td className="max-w-md">
                      <Link
                        to={`/admin/van-ban/${doc.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{documentTypeLabel(doc.document_type)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(doc.issue_date) || '—'}</td>
                    <td>
                      <Badge tone={DOCUMENT_STATUS_TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
                    </td>
                    <td className="text-right">{formatNumber(doc.download_count)}</td>
                  </tr>
                )
              })}
            </tbody>
          </TableCard>
          <Pagination page={page} totalPages={Math.ceil(data.total / DOCUMENT_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}
