import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField } from '@/components/ui/FormControls'
import { isGoogleProviderEnabled } from '@/features/auth/oauth'
import { getSupabaseUrl } from '@/lib/supabase'

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <p className="font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-bg px-2 py-1.5 text-xs">{value}</code>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Chép ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true))
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  )
}

/** Mục đăng nhập trong Thông tin trường, dùng chung cho trình cài đặt và trang quản trị. */
export function GoogleLoginFields({
  enabled,
  clientId,
  clientIdError,
  selfSignup,
  register,
}: {
  enabled: boolean
  clientId: string
  clientIdError?: string
  selfSignup: boolean
  register: {
    enabled: React.InputHTMLAttributes<HTMLInputElement>
    clientId: React.InputHTMLAttributes<HTMLInputElement>
    selfSignup: React.InputHTMLAttributes<HTMLInputElement>
  }
}) {
  const provider = useQuery({
    queryKey: ['auth', 'google-provider', 'setup'],
    queryFn: isGoogleProviderEnabled,
    enabled,
    refetchOnWindowFocus: true,
  })
  const origin = window.location.origin
  const link = 'inline-flex items-center gap-1 text-primary hover:underline'
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold text-text">
        Đăng nhập và thành viên (không bắt buộc)
      </legend>
      <CheckboxField
        label="Cho phép tự đăng ký thành viên"
        hint="Tắt: chỉ người được mời mới có tài khoản, kể cả khi đăng nhập bằng Google. Bật: ai cũng tạo được tài khoản thành viên để bình luận; thành viên không vào được trang quản trị."
        {...register.selfSignup}
        checked={selfSignup}
      />
      <CheckboxField label="Bật đăng nhập nhanh bằng Google" {...register.enabled} checked={enabled} />
      {enabled && (
        <div className="space-y-3 rounded-lg border border-border bg-bg/50 p-4 text-sm">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Mở{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                Google Cloud → Credentials <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              , tạo project nếu chưa có và điền màn hình đồng ý (OAuth consent screen).
            </li>
            <li className="space-y-2">
              <p>Chọn Create credentials → OAuth client ID → Web application, rồi điền hai địa chỉ sau:</p>
              <CopyRow label="Authorized JavaScript origins" value={origin} />
              <CopyRow label="Authorized redirect URIs" value={`${getSupabaseUrl()}/auth/v1/callback`} />
            </li>
            <li>Google cấp Client ID và Client Secret. Giữ trang đó mở.</li>
            <li className="space-y-2">
              <p>
                Mở{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  Supabase <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>{' '}
                → project của trường → Authentication → Sign In / Providers → Google: bật lên, dán Client ID
                và Client Secret rồi lưu.
              </p>
              <p>Trong Authentication → URL Configuration, thêm địa chỉ này vào Redirect URLs:</p>
              <CopyRow label="Redirect URL" value={`${origin}/**`} />
            </li>
            <li>Dán Client ID vào ô dưới đây để nhà trường tiện đối chiếu sau này.</li>
          </ol>
          <Alert tone="warning" title="Không dán Client Secret vào website">
            Client Secret chỉ nhập trong Supabase. Website chỉ lưu Client ID.
          </Alert>
          <Field
            label="Google Client ID"
            placeholder="....apps.googleusercontent.com"
            error={clientIdError}
            {...register.clientId}
            value={clientId}
          />
          {provider.isPending ? null : provider.data ? (
            <Alert tone="success" title="Supabase đã bật Google. Nút đăng nhập đang hiện." />
          ) : (
            <Alert tone="warning" title="Supabase chưa bật Google nên nút đăng nhập chưa hiện.">
              Làm xong bước 4 rồi quay lại trang này, trạng thái sẽ tự cập nhật.
            </Alert>
          )}
        </div>
      )}
    </fieldset>
  )
}
