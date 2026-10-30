import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SchoolLogo } from '@/components/SchoolLogo'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { useAuth } from './auth-context'
import { safeNextPath } from './next-path'

const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { identity } = useSite()
  const { status, signIn } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const next = safeNextPath(params.get('next'))

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (status === 'signed_in') return <Navigate to={next} replace />

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <SchoolLogo className="h-16 w-16" />
          <h1 className="mt-3 text-lg font-bold text-primary">Đăng nhập quản trị</h1>
          <p className="text-sm text-muted">{identity.school_name}</p>
        </div>

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
          <Link to="/dang-ky" className="text-primary hover:underline">
            Được nhà trường mời? Tạo tài khoản
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link to="/" className="text-primary hover:underline">
            ← Về trang chủ
          </Link>
        </p>
      </div>
    </main>
  )
}
