import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SchoolLogo } from '@/components/SchoolLogo'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { useAuth } from './auth-context'
import { safeNextPath } from './next-path'
import { isGoogleProviderEnabled, readOAuthError, signInWithGoogle } from './oauth'

const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
type LoginValues = z.infer<typeof loginSchema>

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.95 10.95 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { identity, authOptions } = useSite()
  const { status, role, signIn } = useAuth()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(() => readOAuthError(location.search, location.hash))
  const [googleBusy, setGoogleBusy] = useState(false)
  const next = safeNextPath(params.get('next'))
  // Chỉ hiện nút khi trường đã bật và Supabase thật sự sẵn sàng, tránh bấm vào ra trang lỗi
  const { data: googleReady = false } = useQuery({
    queryKey: ['auth', 'google-provider'],
    queryFn: isGoogleProviderEnabled,
    enabled: authOptions.google_enabled,
    staleTime: 300_000,
  })

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Thành viên không vào được quản trị: đích mặc định đổi về trang chủ
  if (status === 'signed_in') return <Navigate to={!role && next.startsWith('/admin') ? '/' : next} replace />

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
      if (params.has('next')) navigate(next, { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const google = async () => {
    setError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle(next)
    } catch (err) {
      setError(toVietnameseError(err))
      setGoogleBusy(false)
    }
  }

  const contact = [
    { icon: MapPin, text: identity.address },
    { icon: Phone, text: identity.phone },
    { icon: Mail, text: identity.email },
  ].filter((c) => c.text)

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-2">
      <section className="flex flex-col justify-center bg-gradient-to-br from-primary to-primary-light p-6 text-white sm:p-10 lg:p-16">
        <SchoolLogo className="h-16 w-16 lg:h-24 lg:w-24" />
        {identity.governing_body && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/80 sm:text-sm">
            {identity.governing_body}
          </p>
        )}
        <p className="mt-1 text-xl font-bold uppercase leading-tight lg:text-3xl">{identity.school_name}</p>
        {identity.slogan && <p className="mt-2 font-medium text-accent lg:text-lg">{identity.slogan}</p>}
        {contact.length > 0 && (
          <ul className="mt-6 hidden space-y-2 text-sm text-white/85 lg:block">
            {contact.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-primary">Đăng nhập</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Dành cho cán bộ, giáo viên và thành viên của trường.</p>
          {googleReady && (
            <div className="mb-5 space-y-5">
              <Button variant="outline" className="w-full" loading={googleBusy} onClick={() => void google()}>
                <GoogleMark /> Tiếp tục với Google
              </Button>
              <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                hoặc
              </p>
            </div>
          )}
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {error && <Alert tone="danger" title={error} />}
            <Field
              label="Email"
              type="email"
              autoComplete="username"
              autoFocus
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Field
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Đăng nhập
            </Button>
          </form>
          <p className="mt-6 text-center text-sm">
            <Link to="/quen-mat-khau" className="text-primary hover:underline">
              Quên mật khẩu?
            </Link>
          </p>
          {authOptions.allow_self_signup && (
            <p className="mt-2 text-center text-sm">
              <Link to="/dang-ky" className="text-primary hover:underline">
                Chưa có tài khoản? Đăng ký thành viên
              </Link>
            </p>
          )}
          <p className="mt-2 text-center text-sm">
            <Link to="/" className="text-primary hover:underline">
              ← Về trang chủ
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
