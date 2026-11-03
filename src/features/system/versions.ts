import { getSupabase } from '@/lib/supabase'

const RELEASES_API = 'https://api.github.com/repos/maikhoa-ai-edu/eschool-portal/releases/latest'

export const SCHEMA_VERSION_QUERY_KEY = ['schema-version'] as const
export const LATEST_RELEASE_QUERY_KEY = ['latest-release'] as const
/** GitHub chỉ cho 60 lượt gọi mỗi giờ khi không đăng nhập: chấm báo bản mới chỉ hỏi lại sau từng này */
export const RELEASE_CHECK_STALE_MS = 6 * 60 * 60 * 1000

export interface LatestRelease {
  version: string
  url: string
  notes: string
}

export async function fetchSchemaVersion(): Promise<string> {
  const { data, error } = await getSupabase().rpc('get_schema_version')
  if (error) throw error
  return String(data)
}

export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
  // Chưa có bản phát hành nào
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Không kiểm tra được bản mới trên GitHub. Vui lòng thử lại sau.')
  const data = (await res.json()) as { tag_name: string; html_url: string; body?: string | null }
  return { version: data.tag_name.replace(/^v/, ''), url: data.html_url, notes: data.body ?? '' }
}
