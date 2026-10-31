import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { ShieldAlert, UserX } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button-classes'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuth } from './auth-context'

function Notice({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldAlert
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Icon className="mx-auto h-12 w-12 text-accent" aria-hidden />
      <h1 className="mt-4 text-xl font-bold text-primary">{title}</h1>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </div>
  )
}

/** Chặn trang quản trị: phải đăng nhập và có vai trò còn hiệu lực. */
export function RequireStaff() {
  const { status, role, profile, signOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signed_out') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/dang-nhap?next=${next}`} replace />
  }
  if (!role) {
    return (
      <Notice
        icon={UserX}
        title={profile && !profile.is_active ? 'Tài khoản đã bị khóa' : 'Tài khoản chưa được cấp quyền'}
      >
        <p>Vui lòng liên hệ quản trị viên của trường.</p>
        <button
          type="button"
          className={buttonClasses('outline', 'sm', 'mt-6')}
          onClick={() => void signOut()}
        >
          Đăng xuất
        </button>
      </Notice>
    )
  }
  if (profile?.must_change_password) return <Navigate to="/doi-mat-khau" replace />
  return <Outlet />
}

/** Chặn một trang quản trị theo quyền cụ thể (CSDL vẫn kiểm tra lại bằng RLS). */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <Notice icon={ShieldAlert} title="Không có quyền truy cập">
        <p>Vai trò của bạn không được phép dùng chức năng này.</p>
        <Link to="/admin" className={buttonClasses('outline', 'sm', 'mt-6')}>
          Về trang tổng quan
        </Link>
      </Notice>
    )
  }
  return <>{children}</>
}
