import { createElement, useCallback, useState } from 'react'
import { useSite } from '@/features/site/site-context'
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase'
import { CaptchaBox } from './captcha'

/**
 * Dùng trong biểu mẫu đăng nhập, đăng ký, quên mật khẩu. Không chặn nút gửi ở trình duyệt:
 * Supabase mới là nơi kiểm tra, nên ô xác minh lỗi cũng không khóa trường đang tắt captcha trong Supabase.
 */
export function useCaptcha() {
  const { authOptions } = useSite()
  const siteKey = authOptions.captcha_enabled ? authOptions.captcha_site_key : ''
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const refresh = useCallback(() => setResetKey((k) => k + 1), [])
  return {
    captchaToken: token ?? undefined,
    refreshCaptcha: refresh,
    captchaBox: siteKey ? createElement(CaptchaBox, { siteKey, onToken: setToken, resetKey }) : null,
  }
}

export type CaptchaCheck = 'ok' | 'supabase_off' | 'secret_wrong' | 'unknown'

async function tryLogin(captchaToken?: string): Promise<string | undefined> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: getSupabaseAnonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'kiem-tra-captcha@example.invalid',
      password: 'kiem-tra-captcha',
      ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as { error_code?: string; code?: string }
  return body.error_code ?? body.code
}

/** Thử đăng nhập bằng tài khoản không tồn tại, không có và có mã, để biết Supabase đã khớp với website chưa. */
export async function checkCaptchaSetup(token: string): Promise<CaptchaCheck> {
  const withoutToken = await tryLogin()
  if (withoutToken !== 'captcha_failed')
    return withoutToken === 'invalid_credentials' ? 'supabase_off' : 'unknown'
  const withToken = await tryLogin(token)
  if (withToken === 'invalid_credentials') return 'ok'
  return withToken === 'captcha_failed' ? 'secret_wrong' : 'unknown'
}
