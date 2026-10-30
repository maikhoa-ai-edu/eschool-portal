import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Json } from '@/lib/database.types'
import { CONFIG_PATH, runtimeConfigSchema, type RuntimeConfig } from '@/lib/runtime-config'
import { getSupabase, type AppSupabaseClient } from '@/lib/supabase'
import { REQUIRED_SCHEMA_VERSION } from '@/lib/version'

// ---------------------------------------------------------------------------
// Kiểm tra thông tin kết nối người cài nhập vào
// ---------------------------------------------------------------------------

/** Chuẩn hóa URL người dùng dán vào (bỏ khoảng trắng, dấu / cuối, phần /rest/v1...). */
export function normalizeSupabaseUrl(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/** Khóa bí mật mà lộ ra trình duyệt thì ai cũng bỏ qua được RLS: chặn ngay từ giao diện. */
export function describeKeyProblem(key: string): string | null {
  const trimmed = key.trim()
  if (trimmed.startsWith('sb_secret_') || decodeJwtRole(trimmed) === 'service_role') {
    return 'Đây là khóa bí mật (service_role / secret). Tuyệt đối không dùng trên website; hãy dùng khóa anon (hoặc publishable).'
  }
  if (!/^[A-Za-z0-9._-]{20,}$/.test(trimmed)) {
    return 'Khóa không hợp lệ. Hãy sao chép đầy đủ khóa anon (hoặc publishable) trong trang API của Supabase.'
  }
  return null
}

/** https://<ref>.supabase.co -> mã project, để dựng liên kết tới Dashboard. */
export function supabaseProjectRef(supabaseUrl: string): string | null {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(supabaseUrl)
  return match?.[1] ?? null
}

export function dashboardLink(supabaseUrl: string, path: string): string {
  const ref = supabaseProjectRef(supabaseUrl)
  return ref ? `https://supabase.com/dashboard/project/${ref}/${path}` : 'https://supabase.com/dashboard'
}

// ---------------------------------------------------------------------------
// Trạng thái CSDL
// ---------------------------------------------------------------------------

export type SchemaProbe =
  | { kind: 'ready'; version: string }
  | { kind: 'outdated'; version: string }
  /** Kết nối được nhưng chưa chạy install.sql */
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

interface PostgrestLikeError {
  code?: string
  message?: string
}

/** CSDL chưa có hàm/bảng của eSchool (PostgREST báo không tìm thấy trong schema cache). */
export function isMissingSchemaError(error: PostgrestLikeError): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    error.code === '42883' ||
    /could not find the (function|table)/i.test(error.message ?? '')
  )
}

export function classifySchemaProbe(data: unknown, error: PostgrestLikeError | null): SchemaProbe {
  if (error) {
    if (isMissingSchemaError(error)) return { kind: 'empty' }
    const message = error.message ?? ''
    if (/invalid api key|jwt|unauthorized|no api key/i.test(message)) {
      return { kind: 'error', message: 'Khóa anon không đúng hoặc không thuộc project này.' }
    }
    if (/failed to fetch|network|load failed|fetch failed/i.test(message)) {
      return {
        kind: 'error',
        message: 'Không kết nối được tới địa chỉ Supabase. Kiểm tra lại Project URL và kết nối mạng.',
      }
    }
    return { kind: 'error', message: message || 'Lỗi không xác định khi kết nối Supabase.' }
  }
  const version = String(data ?? '')
  return version === REQUIRED_SCHEMA_VERSION ? { kind: 'ready', version } : { kind: 'outdated', version }
}

export async function probeSchema(client: AppSupabaseClient = getSupabase()): Promise<SchemaProbe> {
  try {
    const { data, error } = await client.rpc('get_schema_version')
    return classifySchemaProbe(data, error)
  } catch (err) {
    return classifySchemaProbe(null, { message: err instanceof Error ? err.message : String(err) })
  }
}

/** Client tạm cho bước nhập kết nối: không lưu phiên đăng nhập. */
export function createProbeClient(config: RuntimeConfig): AppSupabaseClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const installStatusSchema = z.object({
  has_super_admin: z.boolean(),
  completed: z.boolean(),
})
export type InstallStatus = z.infer<typeof installStatusSchema>

export type InstallStatusResult = { kind: 'missing' } | { kind: 'ok'; status: InstallStatus }

export const INSTALL_STATUS_QUERY_KEY = ['install', 'status'] as const

/** Ném lỗi khi mất mạng/lỗi khác; trả 'missing' khi CSDL chưa được khởi tạo. */
export async function fetchInstallStatus(): Promise<InstallStatusResult> {
  const { data, error } = await getSupabase().rpc('get_install_status')
  if (error) {
    if (isMissingSchemaError(error)) return { kind: 'missing' }
    throw error
  }
  return { kind: 'ok', status: installStatusSchema.parse(data) }
}

// ---------------------------------------------------------------------------
// Hosting & config.json
// ---------------------------------------------------------------------------

const phpStatusSchema = z.object({
  eschool: z.literal('install.php'),
  php: z.string(),
  writable: z.boolean(),
  configExists: z.boolean(),
  locked: z.boolean(),
})
export type PhpStatus = z.infer<typeof phpStatusSchema>

export interface HostingInfo {
  /** null: hosting không chạy PHP (Vercel, VibeHost tĩnh, máy phát triển...) hoặc install.php đã tự xóa */
  php: PhpStatus | null
  /** Đường dẫn bất kỳ trả về ứng dụng (cần cho /install, /admin... khi tải lại trang) */
  spaFallback: boolean
  secure: boolean
  vercel: boolean
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    return JSON.parse(await res.text()) as unknown
  } catch {
    return null
  }
}

export async function detectHosting(): Promise<HostingInfo> {
  const { protocol, hostname } = window.location
  const [php, spaFallback] = await Promise.all([
    fetchJson('/install.php').then((body) => phpStatusSchema.safeParse(body).data ?? null),
    fetch(`/__eschool-check-${Date.now()}`, { cache: 'no-store' })
      .then(async (res) => res.ok && (await res.text()).includes('id="root"'))
      .catch(() => false),
  ])
  return {
    php,
    spaFallback,
    secure: protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1',
    vercel: hostname.endsWith('.vercel.app'),
  }
}

export function configJsonText(config: RuntimeConfig): string {
  return (
    JSON.stringify({ supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey }, null, 2) +
    '\n'
  )
}

interface PhpSaveResponse {
  ok?: boolean
  error?: string
  selfDeleted?: boolean
}

export async function saveConfigViaPhp(config: RuntimeConfig): Promise<{ selfDeleted: boolean }> {
  const body = await fetch('/install.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: configJsonText(config),
  })
    .then((res) => res.json() as Promise<PhpSaveResponse | null>)
    .catch(() => {
      throw new Error('Không gọi được install.php trên hosting.')
    })
  if (!body?.ok) throw new Error(body?.error ?? 'install.php không ghi được config.json.')
  return { selfDeleted: Boolean(body.selfDeleted) }
}

/** Tải một đoạn văn bản về máy dưới dạng file. */
export function downloadTextFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** config.json trên hosting đã đúng với kết nối đang dùng chưa. */
export async function isConfigLive(config: RuntimeConfig): Promise<boolean> {
  const parsed = runtimeConfigSchema.safeParse(await fetchJson(CONFIG_PATH))
  return (
    parsed.success &&
    parsed.data.supabaseUrl.replace(/\/+$/, '') === config.supabaseUrl.replace(/\/+$/, '') &&
    parsed.data.supabaseAnonKey === config.supabaseAnonKey
  )
}

// ---------------------------------------------------------------------------
// Ghi cấu hình trường (đi qua RLS: cần quyền settings.manage / modules.manage)
// ---------------------------------------------------------------------------

/** Gộp các trường mới vào một dòng site_settings, đọc bản mới nhất ngay trước khi ghi. */
export async function mergeSiteSetting(key: string, patch: Record<string, Json>): Promise<void> {
  const supabase = getSupabase()
  const current = await supabase.from('site_settings').select('value').eq('key', key).single()
  if (current.error) throw current.error
  const base =
    current.data.value && typeof current.data.value === 'object' && !Array.isArray(current.data.value)
      ? current.data.value
      : {}
  const { data, error } = await supabase
    .from('site_settings')
    .update({ value: { ...base, ...patch } })
    .eq('key', key)
    .select('key')
  if (error) throw error
  // RLS lọc mất dòng thì update không báo lỗi mà trả về 0 dòng
  if (data.length === 0) throw new Error('Bạn không có quyền thực hiện thao tác này.')
}

export async function saveModules(changes: Record<string, boolean>): Promise<void> {
  const supabase = getSupabase()
  const results = await Promise.all(
    Object.entries(changes).map(([moduleKey, enabled]) =>
      supabase
        .from('module_settings')
        .update({ is_enabled: enabled })
        .eq('module_key', moduleKey)
        .select('module_key'),
    ),
  )
  for (const { data, error } of results) {
    if (error) throw error
    if (data.length === 0) throw new Error('Bạn không có quyền thực hiện thao tác này.')
  }
}

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

export function describeLogoProblem(file: File): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.'
  if (file.size > LOGO_MAX_BYTES) return 'Ảnh quá lớn (tối đa 2 MB).'
  return null
}

/** Tải logo lên bucket media (tên file ngẫu nhiên), trả về đường dẫn trong bucket (xem resolveMediaUrl). */
export async function uploadLogo(file: File): Promise<string> {
  const problem = describeLogoProblem(file)
  if (problem) throw new Error(problem)
  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const path = `branding/logo-${crypto.randomUUID()}.${ext}`
  const storage = getSupabase().storage.from('media')
  const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}
