import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField } from '@/components/ui/FormControls'
import { CaptchaBox } from '@/features/auth/captcha'
import { checkCaptchaSetup, type CaptchaCheck } from '@/features/auth/captcha-check'

const RESULTS: Record<CaptchaCheck, { tone: 'success' | 'warning' | 'danger'; text: string }> = {
  ok: { tone: 'success', text: 'Đạt: website và Supabase khớp nhau. Bấm Lưu để áp dụng.' },
  supabase_off: { tone: 'warning', text: 'Supabase chưa bật captcha. Làm bước 3 rồi kiểm tra lại.' },
  secret_wrong: {
    tone: 'danger',
    text: 'Supabase từ chối mã xác minh: kiểm tra Secret key đã dán ở bước 3.',
  },
  unknown: { tone: 'danger', text: 'Không xác định được kết quả. Vui lòng thử lại sau ít phút.' },
}

/** Mục captcha trong Thông tin trường. Phải kiểm tra đạt mới lưu được, tránh khai lệch làm không đăng nhập được. */
export function CaptchaFields({
  enabled,
  siteKey,
  siteKeyError,
  register,
  onChecked,
}: {
  enabled: boolean
  siteKey: string
  siteKeyError?: string
  register: {
    enabled: React.InputHTMLAttributes<HTMLInputElement>
    siteKey: React.InputHTMLAttributes<HTMLInputElement>
  }
  onChecked: (result: { siteKey: string; ok: boolean }) => void
}) {
  const [testing, setTesting] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CaptchaCheck | null>(null)
  const link = 'inline-flex items-center gap-1 text-primary hover:underline'
  const run = async (token: string | null) => {
    if (!token || !testing) return
    setChecking(true)
    const outcome = await checkCaptchaSetup(token).catch((): CaptchaCheck => 'unknown')
    setResult(outcome)
    onChecked({ siteKey: testing, ok: outcome === 'ok' })
    setChecking(false)
    setTesting(null)
  }
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold text-text">Mã bảo mật chống spam (không bắt buộc)</legend>
      <CheckboxField
        label="Bật mã bảo mật Cloudflare Turnstile"
        hint="Áp dụng ở đăng nhập, đăng ký và quên mật khẩu."
        {...register.enabled}
        checked={enabled}
      />
      {enabled && (
        <div className="space-y-3 rounded-lg border border-border bg-bg/50 p-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Mở{' '}
              <a
                href="https://dash.cloudflare.com/?to=/:account/turnstile"
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                Cloudflare → Turnstile <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>{' '}
              (miễn phí), thêm website với tên miền của trường.
            </li>
            <li>Dán Site key vào ô dưới đây.</li>
            <li>
              Trong Supabase → Authentication → Attack Protection: bật CAPTCHA protection, chọn Cloudflare
              Turnstile và dán Secret key.
            </li>
            <li>Bấm Kiểm tra. Khi đạt thì bấm Lưu.</li>
          </ol>
          <Alert tone="warning" title="Secret key chỉ dán trong Supabase, không dán vào website">
            Nếu lỡ bật trong Supabase mà website chưa bật, sẽ không ai đăng nhập được: tắt lại trong Supabase
            là hết.
          </Alert>
          <Field label="Turnstile Site key" error={siteKeyError} {...register.siteKey} value={siteKey} />
          <Button
            variant="outline"
            size="sm"
            loading={checking}
            disabled={!siteKey.trim() || Boolean(testing)}
            onClick={() => {
              setResult(null)
              setTesting(siteKey.trim())
            }}
          >
            Kiểm tra
          </Button>
          {testing && <CaptchaBox siteKey={testing} onToken={(token) => void run(token)} />}
          {result && <Alert tone={RESULTS[result].tone} title={RESULTS[result].text} />}
        </div>
      )}
    </fieldset>
  )
}
