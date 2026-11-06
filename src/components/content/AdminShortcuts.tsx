import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Pencil, Plus, Settings2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'

export interface AdminShortcut {
  label: string
  to: string
  /** Quyền cần có; bỏ trống khi đã tự tính `allowed` (vd tác giả sửa bài của mình) */
  permission?: string
  allowed?: boolean
  kind?: 'edit' | 'add' | 'manage'
}

const ICONS: Record<NonNullable<AdminShortcut['kind']>, LucideIcon> = {
  edit: Pencil,
  add: Plus,
  manage: Settings2,
}

/**
 * Lối tắt sang trang quản trị, chỉ hiện với người có quyền. Đây chỉ là đường tắt:
 * quyền thật vẫn do CSDL (RLS) kiểm tra ở trang quản trị.
 */
export function AdminShortcuts({ items, className }: { items: AdminShortcut[]; className?: string }) {
  const { status, role, can } = useAuth()
  if (status !== 'signed_in' || !role) return null
  const visible = items.filter((i) => i.allowed ?? (i.permission ? can(i.permission) : false))
  if (visible.length === 0) return null
  return (
    <nav
      aria-label="Quản trị nhanh"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm',
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase text-primary">Quản trị</span>
      {visible.map((item) => {
        const Icon = ICONS[item.kind ?? 'edit']
        return (
          <Link
            key={item.to}
            to={item.to}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 font-medium shadow-sm hover:text-primary"
          >
            <Icon className="h-4 w-4" aria-hidden /> {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
