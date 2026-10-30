import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { toVietnameseError } from '@/lib/errors'

export interface Crumb {
  label: string
  to?: string
}

/** Đường dẫn vị trí + tiêu đề trang công khai. */
export function PublicPageHeader({
  title,
  crumbs = [],
  children,
}: {
  title: string
  crumbs?: Crumb[]
  children?: ReactNode
}) {
  return (
    <header className="mb-5 space-y-2">
      <nav aria-label="Vị trí trang" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Trang chủ
            </Link>
          </li>
          {crumbs.map((c) => (
            <li key={c.label} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              {c.to ? (
                <Link to={c.to} className="hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      {children}
    </header>
  )
}

export function PublicQueryState({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (isPending)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    )
  if (error)
    return (
      <Alert tone="danger" title="Không tải được nội dung">
        {toVietnameseError(error)}
      </Alert>
    )
  return null
}

/** Cảnh báo cho nhân sự đang xem bản nháp (khách không bao giờ đọc được bản nháp nhờ RLS). */
export function DraftPreviewNotice() {
  return (
    <div className="mb-4">
      <Alert tone="warning" title="Bản xem trước">
        Nội dung này chưa được đăng, chỉ nhân sự đăng nhập mới thấy.
      </Alert>
    </div>
  )
}

/** Khung hai cột: nội dung chính + cột phụ (xuống dưới trên điện thoại). */
export function WithSidebar({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">{children}</div>
      <aside className="space-y-5">{sidebar}</aside>
    </div>
  )
}

export function SidebarBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <h2 className="border-b-2 border-accent bg-primary px-4 py-2.5 text-sm font-bold uppercase text-white">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  )
}
