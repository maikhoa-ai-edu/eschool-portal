import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { toVietnameseError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase'
import { AuthCard } from './AuthCard'
import { useCaptcha } from './captcha-check'

const schema = z.object({ email: z.email('Email không hợp lệ') })
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { captchaToken, refreshCaptcha, captchaBox } = useCaptcha()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null)
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
        captchaToken,
      })
      if (resetError) throw resetError
      setSentTo(email.trim())
    } catch (err) {
      setError(toVietnameseError(err))
      refreshCaptcha()
    }
  })

  return (
    <AuthCard title="Quên mật khẩu">
      {sentTo ? (
        // Không cho biết email có tài khoản hay không, tránh bị dò danh sách nhân sự
        <Alert tone="success" title="Đã xử lý yêu cầu">
          Nếu <strong>{sentTo}</strong> có tài khoản, hộp thư sẽ nhận được liên kết đặt lại mật khẩu trong vài
          phút. Nhớ xem cả mục thư rác.
        </Alert>
      ) : (
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
          {captchaBox}
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Gửi liên kết đặt lại mật khẩu
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/dang-nhap" className="text-primary hover:underline">
          ← Quay lại đăng nhập
        </Link>
      </p>
    </AuthCard>
  )
}
