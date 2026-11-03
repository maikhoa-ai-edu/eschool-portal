import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCircle2, ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { SchoolLogo } from '@/components/SchoolLogo'
import { BackToTop } from '@/components/ui/BackToTop'
import { CountBadge } from '@/components/ui/CountBadge'
import { ROLE_LABELS, useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { fetchSchemaVersion, SCHEMA_VERSION_QUERY_KEY } from '@/features/system/versions'
import { cn } from '@/lib/cn'
import { APP_VERSION, HOSTING } from '@/lib/version'
import { useAdminNotices, type AdminNotice } from './admin-notices'
import { visibleAdminNav } from './admin-nav'

function Sidebar({ byNav, onNavigate }: { byNav: Map<string, number>; onNavigate?: () => void }) {
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
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <CountBadge count={byNav.get(item.to) ?? 0} label="việc đang chờ" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

/** Chuông ở thanh trên: tổng số việc đang chờ, bấm vào ra danh sách. */
function NoticeBell({ notices, total }: { notices: AdminNotice[]; total: number }) {
  const { pathname } = useLocation()
  // Chỉ mở trên trang đã bấm mở; chuyển trang là tự đóng (giống menu điện thoại)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpenPath(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPath(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-primary"
        aria-label={total > 0 ? `Thông báo, ${total} việc đang chờ` : 'Thông báo'}
        aria-expanded={open}
        aria-controls="admin-notices"
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div
          id="admin-notices"
          className="absolute right-0 top-11 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Việc đang chờ
          </p>
          {notices.length === 0 ? (
            <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Không có việc nào đang chờ bạn.
            </p>
          ) : (
            <ul>
              {notices.map((notice) => (
                <li key={notice.key}>
                  <Link
                    to={notice.to}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-bg"
                    onClick={() => setOpenPath(null)}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                    {notice.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Topbar({
  onOpenMenu,
  notices,
  total,
}: {
  onOpenMenu: () => void
  notices: AdminNotice[]
  total: number
}) {
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
      <NoticeBell notices={notices} total={total} />
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

function AdminFooter() {
  const { identity } = useSite()
  const schema = useQuery({ queryKey: SCHEMA_VERSION_QUERY_KEY, queryFn: fetchSchemaVersion })
  const [year] = useState(() => new Date().getFullYear())
  return (
    <footer className="border-t border-border px-4 py-4 text-xs leading-relaxed text-muted sm:px-6">
      <p>
        © {year} {identity.school_name}. Hệ thống quản trị cổng thông tin eSchool Portal.
      </p>
      <p>
        Phiên bản {APP_VERSION}
        {schema.data && <> · CSDL {schema.data}</>} · Hạ tầng: Supabase{HOSTING && ` và ${HOSTING}`} · Thiết
        kế bởi MVK
      </p>
    </footer>
  )
}

export function AdminLayout() {
  const location = useLocation()
  const { notices, byNav, total } = useAdminNotices()
  // Menu chỉ mở trên trang đã bấm mở; chuyển trang là tự đóng (không cần effect)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const mobileOpen = openPath === location.pathname

  return (
    <div className="flex min-h-screen flex-col lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-primary lg:block">
        <Sidebar byNav={byNav} />
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
            <Sidebar byNav={byNav} onNavigate={() => setOpenPath(null)} />
          </aside>
        </div>
      )}

      <Topbar onOpenMenu={() => setOpenPath(location.pathname)} notices={notices} total={total} />
      <main className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
      <AdminFooter />
      <BackToTop />
    </div>
  )
}
