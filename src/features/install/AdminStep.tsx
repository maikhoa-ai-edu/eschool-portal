import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/features/auth/auth-context'
import { toVietnameseError } from '@/lib/errors'
import type { RuntimeConfig } from '@/lib/runtime-config'
import { getSupabase } from '@/lib/supabase'
import { dashboardLink, INSTALL_STATUS_QUERY_KEY, type InstallStatus } from './api'
import { StepCard } from './ui'

const codeField = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{12}$/, 'Mã cài đặt gồm 12 ký tự (chữ số và chữ A–F)')

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên'),
    email: z.email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirm: z.string(),
    code: codeField,
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })
type SignUpValues = z.infer<typeof signUpSchema>

const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
type LoginValues = z.infer<typeof loginSchema>

const codeSchema = z.object({ code: codeField })

export function AdminStep({ status, config }: { status: InstallStatus; config: RuntimeConfig }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const bootstrap = async (code: string) => {
    const { error: rpcError } = await getSupabase().rpc('bootstrap_super_admin', {
      p_install_code: code.trim(),
    })
    if (rpcError) throw rpcError
    // Vai trò mới nằm trong hồ sơ: tải lại để trình cài đặt sang bước tiếp theo
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['auth'] }),
      queryClient.invalidateQueries({ queryKey: INSTALL_STATUS_QUERY_KEY }),
    ])
  }

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  }

  const header = (
    <>
      Tài khoản này sẽ là <strong>Quản trị viên cấp cao</strong> của website. Các giáo viên khác được mời sau,
      trong trang quản trị.
    </>
  )

  // Đã đăng nhập nhưng chưa có vai trò quản trị
  if (auth.status === 'signed_in' && auth.role !== 'SUPER_ADMIN') {
    if (status.has_super_admin) {
      return (
        <StepCard
          title="Tạo quản trị viên"
          description={`Hệ thống đã có Quản trị viên cấp cao, tài khoản ${auth.profile?.email ?? ''} không có quyền tiếp tục cài đặt.`}
        >
          <Button variant="outline" onClick={() => void auth.signOut()}>
            Đăng xuất để đăng nhập tài khoản khác
          </Button>
        </StepCard>
      )
    }
    return (
      <StepCard title="Nhập mã cài đặt" description={header}>
        <p className="text-sm">
          Đã đăng nhập: <strong>{auth.profile?.email ?? auth.session?.user.email}</strong>.{' '}
          <button type="button" className="text-primary underline" onClick={() => void auth.signOut()}>
            Dùng tài khoản khác
          </button>
        </p>
        <CodeForm error={error} onSubmit={(code) => run(() => bootstrap(code))} />
      </StepCard>
    )
  }

  if (status.has_super_admin) {
    return (
      <StepCard
        title="Đăng nhập quản trị viên"
        description="Quản trị viên cấp cao đã được tạo. Đăng nhập bằng tài khoản đó để cài đặt tiếp."
      >
        <LoginForm error={error} onSubmit={(v) => run(() => auth.signIn(v.email, v.password))} />
      </StepCard>
    )
  }

  if (pendingEmail) {
    return (
      <StepCard title="Xác nhận email" description={header}>
        <Alert tone="info" title={`Đã gửi email xác nhận tới ${pendingEmail}`}>
          <p>
            Mở hộp thư (kể cả mục Spam), bấm liên kết xác nhận. Liên kết sẽ mở lại trang cài đặt; khi đó đăng
            nhập và nhập mã cài đặt.
          </p>
        </Alert>
        <SiteUrlTip config={config} />
        <Button
          variant="outline"
          onClick={() => {
            setPendingEmail(null)
            setMode('login')
          }}
        >
          <MailCheck className="h-4 w-4" aria-hidden /> Tôi đã xác nhận, đăng nhập
        </Button>
      </StepCard>
    )
  }

  const signUp = async (values: SignUpValues) => {
    const { data, error: signUpError } = await getSupabase().auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        data: { full_name: values.fullName.trim() },
        emailRedirectTo: `${window.location.origin}/install`,
      },
    })
    if (signUpError) throw signUpError
    // Supabase giấu việc email đã tồn tại (khi bật xác nhận email): trả về user không có identity
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('User already registered')
    }
    if (!data.session) {
      setPendingEmail(values.email.trim())
      return
    }
    await bootstrap(values.code)
  }

  return (
    <StepCard title="Tạo quản trị viên" description={header}>
      <div role="tablist" aria-label="Tài khoản" className="flex gap-2">
        {(['signup', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setError(null)
              setMode(m)
            }}
            className={
              mode === m
                ? 'rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg'
            }
          >
            {m === 'signup' ? 'Tạo tài khoản mới' : 'Đã có tài khoản'}
          </button>
        ))}
      </div>
      {mode === 'signup' ? (
        <SignUpForm error={error} onSubmit={(v) => run(() => signUp(v))} />
      ) : (
        <LoginForm error={error} onSubmit={(v) => run(() => auth.signIn(v.email, v.password))} />
      )}
      <SiteUrlTip config={config} />
    </StepCard>
  )
}

function SiteUrlTip({ config }: { config: RuntimeConfig }) {
  return (
    <details className="rounded-lg border border-border bg-bg p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Supabase yêu cầu xác nhận email? Không nhận được thư?
      </summary>
      <div className="mt-2 space-y-2 text-muted">
        <p>
          Supabase trên cloud mặc định bắt xác nhận email. Để liên kết trong thư quay về đúng website, mở{' '}
          <a
            href={dashboardLink(config.supabaseUrl, 'auth/url-configuration')}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline"
          >
            Authentication → URL Configuration
          </a>{' '}
          và đặt <strong>Site URL</strong> = <code>{window.location.origin}</code>.
        </p>
        <p>
          Máy chủ email miễn phí của Supabase chỉ gửi vài thư mỗi giờ. Nếu cần, có thể tạm tắt “Confirm email”
          trong Authentication → Sign In / Providers → Email, tạo tài khoản xong thì bật lại.
        </p>
        <p>
          Quên mã cài đặt? Chạy lệnh <code>select install_code from private.install_state;</code> trong SQL
          Editor.
        </p>
      </div>
    </details>
  )
}

function SignUpForm({
  error,
  onSubmit,
}: {
  error: string | null
  onSubmit: (v: SignUpValues) => Promise<void>
}) {
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirm: '', code: '' },
  })
  const e = form.formState.errors
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <Alert tone="danger" title={error} />}
      <Field
        label="Họ và tên"
        autoComplete="name"
        error={e.fullName?.message}
        {...form.register('fullName')}
      />
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        error={e.email?.message}
        {...form.register('email')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      <Field
        label="Mã cài đặt"
        autoComplete="off"
        spellCheck={false}
        hint="12 ký tự hiện ra ở cuối kết quả chạy install.sql."
        className="font-mono uppercase tracking-widest"
        error={e.code?.message}
        {...form.register('code')}
      />
      <Button type="submit" loading={form.formState.isSubmitting}>
        Tạo tài khoản quản trị
      </Button>
    </form>
  )
}

function LoginForm({
  error,
  onSubmit,
}: {
  error: string | null
  onSubmit: (v: LoginValues) => Promise<void>
}) {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const e = form.formState.errors
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <Alert tone="danger" title={error} />}
      <Field
        label="Email"
        type="email"
        autoComplete="username"
        error={e.email?.message}
        {...form.register('email')}
      />
      <Field
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        error={e.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" loading={form.formState.isSubmitting}>
        Đăng nhập
      </Button>
    </form>
  )
}

function CodeForm({ error, onSubmit }: { error: string | null; onSubmit: (code: string) => Promise<void> }) {
  const form = useForm<{ code: string }>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v.code))} noValidate className="space-y-4">
      {error && <Alert tone="danger" title={error} />}
      <Field
        label="Mã cài đặt"
        autoComplete="off"
        spellCheck={false}
        hint="12 ký tự hiện ra ở cuối kết quả chạy install.sql."
        className="font-mono uppercase tracking-widest"
        error={form.formState.errors.code?.message}
        {...form.register('code')}
      />
      <Button type="submit" loading={form.formState.isSubmitting}>
        Xác nhận mã cài đặt
      </Button>
    </form>
  )
}
