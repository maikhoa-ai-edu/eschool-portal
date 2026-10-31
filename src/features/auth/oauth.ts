import { getSupabase, getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase'

/** Supabase đã bật đăng nhập Google chưa (khóa ẩn danh đọc được; Client Secret không bao giờ trả về). */
export async function isGoogleProviderEnabled(): Promise<boolean> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/settings`, {
    headers: { apikey: getSupabaseAnonKey() },
  })
  if (!response.ok) return false
  const body = (await response.json()) as { external?: { google?: boolean } }
  return body.external?.google === true
}

/** Google trả về đúng trang đăng nhập để lỗi (chưa được mời) hiện ngay tại đây. */
export async function signInWithGoogle(next: string): Promise<void> {
  const redirectTo = `${window.location.origin}/dang-nhap?next=${encodeURIComponent(next)}`
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

/** Lỗi OAuth Supabase gắn vào địa chỉ khi quay về; trigger từ chối đăng ký thì thành "Database error". */
export function readOAuthError(search: string, hash: string): string | null {
  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const description = params.get('error_description') ?? hashParams.get('error_description')
  const code = params.get('error') ?? hashParams.get('error')
  if (!description && !code) return null
  if (/database error/i.test(description ?? '')) {
    return 'Email Google này chưa được mời, và trường chưa cho phép tự đăng ký. Hãy liên hệ nhà trường.'
  }
  if (code === 'access_denied') return 'Bạn đã hủy đăng nhập bằng Google.'
  return 'Không đăng nhập được bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.'
}
