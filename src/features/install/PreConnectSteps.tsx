import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { readInstallDraft, updateInstallDraft } from '@/lib/install-draft'
import {
  createProbeClient,
  describeKeyProblem,
  detectHosting,
  normalizeSupabaseUrl,
  probeSchema,
} from './api'
import { CheckItem, StepCard, Steps, WizardShell } from './ui'

/** Bước 1–2: chạy khi website chưa có cấu hình kết nối nào. */
export function PreConnectSteps() {
  const [step, setStep] = useState(() => (readInstallDraft().step === 2 ? 2 : 1))

  const goTo = (next: 1 | 2) => {
    updateInstallDraft({ step: next })
    setStep(next)
  }

  return (
    <WizardShell current={step}>
      {step === 1 ? <EnvironmentStep onNext={() => goTo(2)} /> : <ConnectStep onBack={() => goTo(1)} />}
    </WizardShell>
  )
}

function browserSupported(): boolean {
  try {
    window.localStorage.setItem('eschool:probe', '1')
    window.localStorage.removeItem('eschool:probe')
    return typeof fetch === 'function' && typeof crypto.randomUUID === 'function'
  } catch {
    return false
  }
}

function EnvironmentStep({ onNext }: { onNext: () => void }) {
  const hosting = useQuery({ queryKey: ['install', 'hosting'], queryFn: detectHosting })
  const supported = browserSupported()

  return (
    <StepCard
      title="Chào mừng đến với eSchool Portal"
      description="Trình cài đặt sẽ kết nối website với cơ sở dữ liệu riêng của trường, tạo tài khoản quản trị và thiết lập thông tin nhà trường. Thời gian khoảng 15 phút."
      actions={
        <>
          <span />
          <Button onClick={onNext} disabled={!supported}>
            Bắt đầu cài đặt
          </Button>
        </>
      }
    >
      <div>
        <h2 className="text-sm font-semibold text-text">Kiểm tra môi trường</h2>
        {hosting.isPending ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Spinner /> Đang kiểm tra hosting...
          </div>
        ) : (
          <ul className="divide-y divide-border">
            <CheckItem state={supported ? 'ok' : 'fail'} title="Trình duyệt">
              {supported
                ? 'Trình duyệt đáp ứng yêu cầu.'
                : 'Trình duyệt quá cũ hoặc đang chặn lưu trữ. Hãy dùng Chrome, Edge hoặc Firefox bản mới (không ở chế độ ẩn danh).'}
            </CheckItem>
            <CheckItem state={hosting.data?.secure ? 'ok' : 'warn'} title="Kết nối bảo mật (HTTPS)">
              {hosting.data?.secure
                ? 'Website đang chạy qua HTTPS.'
                : 'Website chưa có HTTPS. Hãy bật chứng chỉ SSL (cPanel thường có AutoSSL miễn phí) để bảo vệ mật khẩu.'}
            </CheckItem>
            <CheckItem state={hosting.data?.spaFallback ? 'ok' : 'warn'} title="Điều hướng trang">
              {hosting.data?.spaFallback
                ? 'Hosting chuyển mọi đường dẫn về ứng dụng đúng cách.'
                : 'Mở trực tiếp các đường dẫn như /admin có thể bị lỗi 404. Trên cPanel, hãy chắc chắn đã tải lên cả file .htaccess (file ẩn) đi kèm bản phát hành.'}
            </CheckItem>
            <HostingCheck php={hosting.data?.php ?? null} />
          </ul>
        )}
      </div>

      <Alert tone="info" title="Cần chuẩn bị trước">
        <p>
          Một project Supabase (gói miễn phí là đủ). Chưa có thì tạo tại{' '}
          <a
            href="https://supabase.com/dashboard/new"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            supabase.com/dashboard/new
          </a>{' '}
          — chọn khu vực Singapore cho nhanh, ghi lại mật khẩu CSDL ở nơi an toàn.
        </p>
      </Alert>
    </StepCard>
  )
}

function HostingCheck({ php }: { php: Awaited<ReturnType<typeof detectHosting>>['php'] }) {
  if (!php) {
    return (
      <CheckItem state="info" title="Lưu cấu hình">
        Hosting không chạy PHP (Vercel, hosting tĩnh...). Ở bước 4 bạn sẽ tải file config.json về rồi đưa lên
        hosting, hoặc đặt biến môi trường trên Vercel.
      </CheckItem>
    )
  }
  if (php.locked) {
    return (
      <CheckItem state="warn" title={`Hosting có PHP ${php.php}`}>
        install.php đã bị khóa vì đã có config.json. Muốn cài lại, hãy xóa config.json và
        .eschool-install.lock bằng File Manager.
      </CheckItem>
    )
  }
  return (
    <CheckItem state={php.writable ? 'ok' : 'warn'} title={`Hosting có PHP ${php.php}`}>
      {php.writable
        ? 'Trình cài đặt sẽ tự ghi file config.json lên hosting.'
        : 'Thư mục website không cho ghi file; bạn sẽ tải config.json về rồi tải lên bằng File Manager.'}
    </CheckItem>
  )
}

const connectSchema = z.object({
  supabaseUrl: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập Project URL')
    .refine((v) => normalizeSupabaseUrl(v) !== null, 'URL không hợp lệ (dạng https://xxxx.supabase.co)'),
  supabaseAnonKey: z
    .string()
    .trim()
    .min(1, 'Vui lòng dán khóa anon')
    .superRefine((v, ctx) => {
      const problem = describeKeyProblem(v)
      if (problem) ctx.addIssue({ code: 'custom', message: problem })
    }),
})
type ConnectValues = z.infer<typeof connectSchema>

function ConnectStep({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ConnectValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      supabaseUrl: readInstallDraft().connection?.supabaseUrl ?? '',
      supabaseAnonKey: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const config = {
      supabaseUrl: normalizeSupabaseUrl(values.supabaseUrl)!,
      supabaseAnonKey: values.supabaseAnonKey.trim(),
    }
    const probe = await probeSchema(createProbeClient(config))
    if (probe.kind === 'error') {
      setError(probe.message)
      return
    }
    if (probe.kind === 'outdated') {
      setError(
        `CSDL này đang ở phiên bản ${probe.version || 'không rõ'}, không khớp bản website. Hãy dùng một project Supabase mới.`,
      )
      return
    }
    // Kết nối dùng được: lưu bản nháp rồi tải lại để cả ứng dụng chạy với kết nối này
    updateInstallDraft({ connection: config, configStepDone: false, step: 3 })
    window.location.assign('/install')
  })

  return (
    <StepCard
      title="Kết nối cơ sở dữ liệu Supabase"
      description="Mỗi trường dùng một project Supabase riêng. Website chỉ cần địa chỉ project và khóa công khai (anon)."
      actions={
        <>
          <Button variant="ghost" onClick={onBack}>
            ← Quay lại
          </Button>
          <Button type="submit" form="connect-form" loading={form.formState.isSubmitting}>
            Kiểm tra kết nối
          </Button>
        </>
      }
    >
      <Steps>
        <li>
          Mở trang{' '}
          <a
            href="https://supabase.com/dashboard/project/_/settings/api"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary underline"
          >
            Project Settings → API <ExternalLink className="h-3 w-3" aria-hidden />
          </a>{' '}
          của project.
        </li>
        <li>
          Sao chép <strong>Project URL</strong> và khóa <strong>anon public</strong> (hoặc{' '}
          <strong>Publishable key</strong>).
        </li>
        <li>
          <strong className="text-danger">Không</strong> dùng khóa <em>service_role</em> / <em>secret</em>.
        </li>
      </Steps>

      <form id="connect-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <Alert tone="danger" title="Chưa kết nối được">
            {error}
          </Alert>
        )}
        <Field
          label="Project URL"
          placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
          autoComplete="off"
          spellCheck={false}
          error={form.formState.errors.supabaseUrl?.message}
          {...form.register('supabaseUrl')}
        />
        <Field
          label="Khóa anon (public)"
          placeholder="eyJhbGciOi... hoặc sb_publishable_..."
          autoComplete="off"
          spellCheck={false}
          error={form.formState.errors.supabaseAnonKey?.message}
          {...form.register('supabaseAnonKey')}
        />
      </form>
    </StepCard>
  )
}
