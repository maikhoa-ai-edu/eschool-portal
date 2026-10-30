import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { AdminPageHeader, QueryState, TableCard } from '@/components/admin/AdminPage'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { SelectField } from '@/components/ui/FormControls'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { formatDateTime, formatNumber } from '@/lib/format'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_KEY,
  AUDIT_PAGE_SIZE,
  AUDIT_TABLE_LABELS,
  auditActorName,
  auditFieldLabels,
  auditTarget,
  fetchAuditActors,
  fetchAuditLogs,
  SYSTEM_ACTOR,
} from './api'

const ACTION_TONES: Record<string, BadgeTone> = { INSERT: 'success', UPDATE: 'info', DELETE: 'danger' }

const TABLE_OPTIONS = Object.entries(AUDIT_TABLE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'vi'))

export function AuditActionBadge({ action }: { action: string }) {
  return <Badge tone={ACTION_TONES[action] ?? 'neutral'}>{AUDIT_ACTION_LABELS[action] ?? action}</Badge>
}

export function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const filters = {
    actor: params.get('nguoi') ?? '',
    table: params.get('bang') ?? '',
    from: params.get('tu') ?? '',
    to: params.get('den') ?? '',
  }
  const page = readPage(params)

  const setFilter = (name: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(name, value)
      else next.delete(name)
      next.delete('trang')
      return next
    })
  }

  const actors = useQuery({ queryKey: [...AUDIT_KEY, 'actors'], queryFn: fetchAuditActors })
  const { data, isPending, error } = useQuery({
    queryKey: [...AUDIT_KEY, filters, page],
    queryFn: () => fetchAuditLogs(filters, page),
  })

  return (
    <div>
      <AdminPageHeader
        title="Nhật ký"
        description="Ai đã thay đổi gì, ghi tự động trong Cơ sở dữ liệu; không ai sửa hoặc xóa được qua website."
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label="Người thực hiện"
          placeholder="Tất cả"
          value={filters.actor}
          onChange={(e) => setFilter('nguoi', e.target.value)}
          options={[
            { value: SYSTEM_ACTOR, label: 'Hệ thống' },
            ...(actors.data ?? []).map((a) => ({ value: a.id, label: a.full_name })),
          ]}
        />
        <SelectField
          label="Mục dữ liệu"
          placeholder="Tất cả"
          value={filters.table}
          onChange={(e) => setFilter('bang', e.target.value)}
          options={TABLE_OPTIONS}
        />
        <Field
          label="Từ ngày"
          type="date"
          value={filters.from}
          onChange={(e) => setFilter('tu', e.target.value)}
        />
        <Field
          label="Đến ngày"
          type="date"
          value={filters.to}
          onChange={(e) => setFilter('den', e.target.value)}
        />
      </div>

      <QueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState title="Không có dòng nhật ký nào khớp bộ lọc" />}
      {data && data.items.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted">{formatNumber(data.total)} dòng nhật ký</p>
          <TableCard>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Trường thay đổi</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(entry.occurred_at)}</td>
                  <td className="whitespace-nowrap font-medium">{auditActorName(entry)}</td>
                  <td>
                    <AuditActionBadge action={entry.action} />
                  </td>
                  <td className="max-w-sm">{auditTarget(entry)}</td>
                  <td className="max-w-xs text-muted">{auditFieldLabels(entry.changed_fields) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          <Pagination page={page} totalPages={Math.ceil(data.total / AUDIT_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}
