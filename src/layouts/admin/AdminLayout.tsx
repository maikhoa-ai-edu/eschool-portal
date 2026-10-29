import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { SchoolLogo } from '@/components/SchoolLogo'
import { ROLE_LABELS, useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { visibleAdminNav } from './admin-nav'

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth()
  const { identity, isModuleEnabled } = useSite()
  const groups = visibleAdminNav(can, isModuleEnabled)

  return (
    <div className="flex h-full flex-col">
      <Link
        to="/admin"
        className="flex items-center gap-3 border-b border-white/10 px-4 py-4"
        onClick={onNavigate}
      >
        <SchoolLogo className="h-10 w-10 text-sm" />
        <span className="min-w-0">
          <span className="block text-xs text-white/60">Quản trị</span>
          <span className="block truncate text-sm font-semibold text-white">
            {identity.short_name || identity.school_name}
          </span>
        </span>
      </Link>
      <nav aria-label="Menu quản trị" className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              {group.label}
            </p>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white',
                        isActive && 'bg-white/15 font-semibold text-white',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <p className="border-t border-white/10 px-4 py-3 text-[11px] text-white/40">
        eSchool Portal v{__APP_VERSION__} · Thiết kế bởi MVK
      </p>
    </div>
  )
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { profile, role, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg lg:hidden"
        aria-label="Mở menu quản trị"
        onClick={onOpenMenu}
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <Link
        to="/"
        target="_blank"
        className="hidden items-center gap-1.5 text-sm text-muted hover:text-primary sm:inline-flex"
      >
        Xem trang công khai <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <div className="flex items-center gap-3 border-l border-border pl-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-semibold">{profile?.full_name}</p>
          <p className="text-xs text-muted">{role ? ROLE_LABELS[role] : ''}</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-danger"
          aria-label="Đăng xuất"
          title="Đăng xuất"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

export function AdminLayout() {
  const location = useLocation()
  // Menu chỉ mở trên trang đã bấm mở; chuyển trang là tự đóng (không cần effect)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const mobileOpen = openPath === location.pathname

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-primary lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu quản trị"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Đóng menu"
            onClick={() => setOpenPath(null)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-primary">
            <button
              type="button"
              className="absolute right-2 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
              aria-label="Đóng menu"
              onClick={() => setOpenPath(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpenPath(null)} />
          </aside>
        </div>
      )}

      <Topbar onOpenMenu={() => setOpenPath(location.pathname)} />
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
