import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { toVietnameseError } from '@/lib/errors'

/** Tiêu đề trang quản trị: tên, mô tả, nút thao tác bên phải và liên kết quay lại (nếu có). */
export function AdminPageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Quay lại danh sách',
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="mb-5 space-y-2">
      {backTo && (
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">{title}</h1>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Trạng thái tải / lỗi chung cho các truy vấn ở trang quản trị. */
export function QueryState({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (isPending)
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-7 w-7" />
      </div>
    )
  if (error)
    return (
      <Alert tone="danger" title="Không tải được dữ liệu">
        {toVietnameseError(error)}
      </Alert>
    )
  return null
}

/** Khung bảng có cuộn ngang trên màn hình hẹp. */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:text-muted [&_thead]:border-b [&_thead]:border-border [&_thead]:bg-bg/60 [&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  )
}

/** Khối có tiêu đề trong các biểu mẫu quản trị. */
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      {title && <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>}
      {children}
    </section>
  )
}
