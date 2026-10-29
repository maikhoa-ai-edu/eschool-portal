import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LogIn, LayoutDashboard } from 'lucide-react'
import { SchoolLogo } from '@/components/SchoolLogo'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function UtilityBar() {
  const now = useNow()
  const { status, role } = useAuth()
  const date = dateFormat.format(now)

  return (
    <div className="bg-primary text-xs text-white/90">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4">
        <p>
          <time dateTime={now.toISOString()}>
            {timeFormat.format(now)} · {date.charAt(0).toUpperCase() + date.slice(1)}
          </time>
        </p>
        {status === 'signed_in' && role ? (
          <Link to="/admin" className="inline-flex items-center gap-1.5 hover:text-white">
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden /> Trang quản trị
          </Link>
        ) : (
          <Link to="/dang-nhap" className="inline-flex items-center gap-1.5 hover:text-white">
            <LogIn className="h-3.5 w-3.5" aria-hidden /> Đăng nhập
          </Link>
        )}
      </div>
    </div>
  )
}

function BrandBanner() {
  const { identity, branding } = useSite()
  return (
    <div
      className="relative bg-primary-light bg-cover bg-center text-white"
      style={
        branding.banner_url ? { backgroundImage: `url("${encodeURI(branding.banner_url)}")` } : undefined
      }
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[110px] max-w-7xl items-center gap-4 px-4 py-4">
        <Link to="/" aria-label="Về trang chủ" className="shrink-0">
          <SchoolLogo className="h-16 w-16 sm:h-20 sm:w-20" />
        </Link>
        <div className="min-w-0">
          {identity.governing_body && (
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80 sm:text-sm">
              {identity.governing_body}
            </p>
          )}
          <p className="text-lg font-bold uppercase leading-tight text-white sm:text-2xl">
            {identity.school_name}
          </p>
          {identity.slogan && (
            <p className="mt-0.5 text-sm font-medium text-accent sm:text-base">{identity.slogan}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function SiteHeader() {
  return (
    <header>
      <UtilityBar />
      <BrandBanner />
    </header>
  )
}
