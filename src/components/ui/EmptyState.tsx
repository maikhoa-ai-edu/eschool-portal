import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
}: {
  icon?: LucideIcon
  title: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-muted" aria-hidden />
      <p className="mt-2 font-semibold text-text">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}
