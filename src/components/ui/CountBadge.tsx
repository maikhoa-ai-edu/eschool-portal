import { cn } from '@/lib/cn'

/** Chấm đỏ số trắng báo việc mới. Không có việc thì không hiện. */
export function CountBadge({
  count,
  label,
  className,
}: {
  count: number
  label: string
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white',
        className,
      )}
    >
      <span aria-hidden>{count > 99 ? '99+' : count}</span>
      <span className="sr-only">
        , {count} {label}
      </span>
    </span>
  )
}
