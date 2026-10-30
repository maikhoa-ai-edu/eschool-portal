import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useSearchParams } from 'react-router'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SchoolLogo } from '@/components/SchoolLogo'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from './auth-context'

const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Vui lòng nhập họ và tên'),
    email: z.email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })
type RegisterValues = z.infer<typeof registerSchema>

/** Đăng ký bằng email được mời: CSDL (trigger handle_new_user) từ chối email khác và tự gán vai trò. */
export function RegisterPage() {
  const { identity } = useSite()
  const { status } = useAuth()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: params.get('email') ?? '', password: '', confirm: '' },
  })
  const e = form.formState.errors

  if (status === 'signed_in') return <Navigate to="/admin" replace />

  const onSubmit = form.handleSubmit(async ({ fullName, email, password }) => {
    setError(null)
    try {
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      })
      if (signUpError) throw signUpError
      // Supabase giấu việc email đã tồn tại (khi bật xác nhận email): trả về user không có identity
      if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
      // Có phiên thì status đổi sang signed_in và tự chuyển trang; không có phiên nghĩa là chờ xác nhận email
      if (!data.session) setPendingEmail(email.trim())
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <SchoolLogo className="h-16 w-16" />
          <h1 className="mt-3 text-lg font-bold text-primary">Tạo tài khoản theo lời mời</h1>
          <p className="text-sm text-muted">{identity.school_name}</p>
        </div>

        {pendingEmail ? (
          <div className="space-y-4">
            <Alert tone="success" title="Đã tạo tài khoản">
              Mở hộp thư <strong>{pendingEmail}</strong> và bấm vào liên kết xác nhận, sau đó đăng nhập.
            </Alert>
            <Link
              to="/dang-nhap?next=%2Fadmin"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              <MailCheck className="h-4 w-4" aria-hidden /> Tôi đã xác nhận, đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {error && <Alert tone="danger" title={error} />}
            <Field
              label="Email được mời"
              type="email"
              autoComplete="email"
              hint="Phải đúng email mà nhà trường đã mời."
              error={e.email?.message}
              {...form.register('email')}
            />
            <Field
              label="Họ và tên"
              autoComplete="name"
              autoFocus
              error={e.fullName?.message}
              {...form.register('fullName')}
            />
            <Field
              label="Mật khẩu"
              type="password"
              autoComplete="new-password"
              error={e.password?.message}
              {...form.register('password')}
            />
            <Field
              label="Nhập lại mật khẩu"
              type="password"
              autoComplete="new-password"
              error={e.confirm?.message}
              {...form.register('confirm')}
            />
            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              Tạo tài khoản
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link to="/dang-nhap" className="text-primary hover:underline">
            Đã có tài khoản? Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  )
}
