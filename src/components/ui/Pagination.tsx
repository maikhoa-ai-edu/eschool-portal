import { Link, useLocation } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { pageWindow } from './page-utils'

/** Phân trang bằng tham số ?trang= trên URL (giữ nguyên các tham số lọc khác). */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const location = useLocation()
  if (totalPages <= 1) return null

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(location.search)
    if (p === 1) params.delete('trang')
    else params.set('trang', String(p))
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ''}`
  }
  const item = 'flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-sm'

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-center gap-1.5 pt-4">
      {page > 1 && (
        <Link to={hrefFor(page - 1)} className={cn(item, 'bg-surface hover:bg-bg')} aria-label="Trang trước">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            to={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              item,
              p === page ? 'border-primary bg-primary font-semibold text-white' : 'bg-surface hover:bg-bg',
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link to={hrefFor(page + 1)} className={cn(item, 'bg-surface hover:bg-bg')} aria-label="Trang sau">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  )
}
