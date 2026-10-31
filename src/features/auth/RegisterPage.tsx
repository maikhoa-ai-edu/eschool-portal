import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useSearchParams } from 'react-router'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { toVietnameseError } from '@/lib/errors'
import { useSite } from '@/features/site/site-context'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'

const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Vui lòng nhập họ và tên'),
    password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })
type RegisterValues = z.infer<typeof registerSchema>

/**
 * Đăng ký bằng liên kết mời, hoặc tự đăng ký thành viên khi trường cho phép.
 * Mọi trường hợp đều do CSDL (trigger handle_new_user) kiểm tra lại và gán vai trò.
 */
export function RegisterPage() {
  const { status, role } = useAuth()
  const { authOptions } = useSite()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const invitedEmail = params.get('email') ?? ''
  const token = params.get('ma') ?? ''
  const invited = Boolean(invitedEmail && token)
  const selfSignup = !invited && authOptions.allow_self_signup
  const [typedEmail, setTypedEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const email = invited ? invitedEmail : typedEmail.trim()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', password: '', confirm: '' },
  })
  const e = form.formState.errors

  if (status === 'signed_in') return <Navigate to={role ? '/admin' : '/'} replace />

  const onSubmit = form.handleSubmit(async ({ fullName, password }) => {
    setError(null)
    setEmailError(null)
    if (!z.email().safeParse(email).success) {
      setEmailError('Email không hợp lệ')
      return
    }
    try {
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, invite_token: token },
          emailRedirectTo: `${window.location.origin}${invited ? '/admin' : '/'}`,
        },
      })
      if (signUpError) throw signUpError
      // Supabase giấu việc email đã tồn tại (khi bật xác nhận email): trả về user không có identity
      if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
      // Có phiên thì status đổi sang signed_in và tự chuyển trang; không có phiên nghĩa là chờ xác nhận email
      if (!data.session) setPendingEmail(email)
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <AuthCard title={selfSignup ? 'Đăng ký thành viên' : 'Tạo tài khoản theo lời mời'}>
      {!invited && !selfSignup ? (
        <Alert tone="warning" title="Cần có liên kết mời">
          Chỉ tạo được tài khoản bằng liên kết mời do quản trị viên của trường gửi. Hãy mở đúng liên kết đó
          hoặc liên hệ nhà trường để được mời.
        </Alert>
      ) : pendingEmail ? (
        <div className="space-y-4">
          <Alert tone="success" title="Đã tạo tài khoản">
            Mở hộp thư <strong>{pendingEmail}</strong> và bấm vào liên kết xác nhận, sau đó đăng nhập.
          </Alert>
          <Link
            to={invited ? '/dang-nhap?next=%2Fadmin' : '/dang-nhap'}
            className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
          >
            <MailCheck className="h-4 w-4" aria-hidden /> Tôi đã xác nhận, đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert tone="danger" title={error} />}
          {invited ? (
            <Field label="Email được mời" type="email" value={email} readOnly className="bg-bg text-muted" />
          ) : (
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={typedEmail}
              error={emailError ?? undefined}
              onChange={(event) => setTypedEmail(event.target.value)}
            />
          )}
          <Field
            label="Họ và tên"
            autoComplete="name"
            autoFocus={invited}
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
    </AuthCard>
  )
}
