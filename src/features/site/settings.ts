import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'

const text = z.string().trim().catch('')
const hexColor = (fallback: string) =>
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .catch(fallback)
const optionalUrl = z.string().trim().min(1).nullable().catch(null)

export const schoolIdentitySchema = z.object({
  school_name: z.string().trim().min(1).catch('Tên trường'),
  short_name: text,
  governing_body: text,
  slogan: text,
  address: text,
  phone: text,
  email: text,
  principal: text,
  facebook_url: text,
  youtube_url: text,
  zalo_url: text,
})

export const brandingSchema = z.object({
  primary_color: hexColor('#002B66'),
  primary_light_color: hexColor('#003B8E'),
  accent_color: hexColor('#D97706'),
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
  banner_url: optionalUrl,
})

export const marqueeSchema = z.object({
  enabled: z.boolean().catch(false),
  items: z.array(z.string().trim().min(1)).catch([]),
})

export type SchoolIdentity = z.infer<typeof schoolIdentitySchema>
export type Branding = z.infer<typeof brandingSchema>
export type Marquee = z.infer<typeof marqueeSchema>

export interface SiteSettings {
  identity: SchoolIdentity
  branding: Branding
  marquee: Marquee
  modules: Record<string, boolean>
}

export const SITE_SETTINGS_QUERY_KEY = ['site-settings'] as const

export const MODULE_KEYS = ['news', 'announcements', 'documents', 'albums', 'pages'] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

/** Chuyển các dòng site_settings/module_settings thành cấu hình đã kiểm tra hợp lệ. */
export function parseSiteSettings(
  rows: Array<{ key: string; value: unknown }>,
  moduleRows: Array<{ module_key: string; is_enabled: boolean }>,
): SiteSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  return {
    identity: schoolIdentitySchema.parse(byKey.get('school_identity') ?? {}),
    branding: brandingSchema.parse(byKey.get('branding') ?? {}),
    marquee: marqueeSchema.parse(byKey.get('marquee') ?? {}),
    modules: Object.fromEntries(moduleRows.map((m) => [m.module_key, m.is_enabled])),
  }
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const supabase = getSupabase()
  const [settings, modules] = await Promise.all([
    supabase.from('site_settings').select('key, value'),
    supabase.from('module_settings').select('module_key, is_enabled'),
  ])
  if (settings.error) throw settings.error
  if (modules.error) throw modules.error
  return parseSiteSettings(settings.data, modules.data)
}

/** Chỉ cho phép liên kết http(s) để tránh javascript: trong href. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}
