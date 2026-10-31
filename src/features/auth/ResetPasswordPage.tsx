import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { toVietnameseError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'

const schema = z
  .object({
    password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })
type Values = z.infer<typeof schema>

/** Supabase tự đọc liên kết trong thư và tạo phiên; trang này chỉ cần đặt mật khẩu mới cho phiên đó. */
export function ResetPasswordPage() {
  const { status, profile, role } = useAuth()
  const queryClient = useQueryClient()
  const forced = Boolean(profile?.must_change_password)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })
  const e = form.formState.errors

  if (status === 'loading') return <FullPageSpinner />

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null)
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password })
      if (updateError) throw updateError
      // Máy chủ đã xóa cờ buộc đổi: tải lại hồ sơ trước khi vào, kẻo bị đưa ngược về đây
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] })
      navigate(role ? '/admin' : '/', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <AuthCard title={forced ? 'Đổi mật khẩu lần đầu' : 'Đặt lại mật khẩu'}>
      {status === 'signed_out' ? (
        <div className="space-y-4">
          <Alert tone="danger" title="Liên kết không hợp lệ hoặc đã hết hạn" />
          <Link to="/quen-mat-khau" className="block text-center text-sm text-primary hover:underline">
            Gửi lại liên kết mới
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert tone="danger" title={error} />}
          {forced && (
            <Alert
              tone="warning"
              title="Mật khẩu được cấp chỉ dùng một lần. Hãy đặt mật khẩu của riêng bạn."
            />
          )}
          <Field
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            autoFocus
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
            Lưu mật khẩu mới
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
