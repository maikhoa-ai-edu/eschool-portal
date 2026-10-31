import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { homepageSchema, type HomepageSettings } from './homepage-settings'

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
  tiktok_url: text,
})

export const brandingSchema = z.object({
  primary_color: hexColor('#002B66'),
  primary_light_color: hexColor('#003B8E'),
  accent_color: hexColor('#D97706'),
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
  banner_url: optionalUrl,
})

export interface MarqueeItem {
  text: string
  /** Liên kết trong website (/...) hoặc http(s); không hợp lệ thì bỏ */
  url: string | null
}

const marqueeItemSchema = z.union([
  z.string().transform((text) => ({ text, url: null })),
  z.object({ text: z.string().catch(''), url: z.string().nullable().catch(null) }),
])

/** Dòng chữ chạy. Bản cũ lưu mảng chuỗi, bản mới lưu {text, url}; cả hai đều đọc được. */
export const marqueeSchema = z.object({
  enabled: z.boolean().catch(false),
  label: z
    .string()
    .trim()
    .max(40)
    .catch('')
    .transform((v) => v || 'Tin nổi bật'),
  /** Khóa trong MENU_ICONS; rỗng = tia sét như bản cũ */
  icon: text,
  /** Rỗng = nền trắng như bản cũ */
  bg_color: text.transform((v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : '')),
  /** Giây cho một vòng chạy */
  speed: z.union([z.literal(25), z.literal(40), z.literal(60)]).catch(40),
  include_latest_news: z.boolean().catch(false),
  items: z
    .array(z.unknown())
    .catch([])
    .transform((list): MarqueeItem[] =>
      list.flatMap((raw) => {
        const parsed = marqueeItemSchema.safeParse(raw)
        if (!parsed.success) return []
        const text = parsed.data.text.trim()
        const url = parsed.data.url?.trim() ?? ''
        return text ? [{ text, url: /^(\/|https?:\/\/)\S*$/.test(url) ? url : null }] : []
      }),
    ),
})

export interface FooterInfoLine {
  icon: string
  text: string
  /** Trong website (/...), http(s), tel: hoặc mailto:; không hợp lệ thì chỉ hiện chữ */
  url: string | null
}

/** Đầu trang và chân trang. Thiếu khóa (cấu hình cũ) thì mọi tùy chọn tắt, giao diện giữ nguyên. */
export const siteChromeSchema = z.object({
  header_social: z.boolean().catch(false),
  nav_search: z.boolean().catch(false),
  /** Trang Thông báo, Văn bản có cột phải */
  content_sidebar: z.boolean().catch(false),
  footer_link_icons: z.boolean().catch(false),
  footer_connect_icons: z.boolean().catch(false),
  footer_info_lines: z
    .array(z.unknown())
    .catch([])
    .transform((list): FooterInfoLine[] =>
      list.flatMap((raw) => {
        const parsed = z
          .object({
            icon: z.string().catch('info'),
            text: z.string().catch(''),
            url: z.string().nullable().catch(null),
          })
          .safeParse(raw)
        if (!parsed.success) return []
        const text = parsed.data.text.trim()
        const url = parsed.data.url?.trim() ?? ''
        return text
          ? [
              {
                icon: parsed.data.icon,
                text,
                url: /^(\/|https?:\/\/|tel:|mailto:)\S*$/.test(url) ? url : null,
              },
            ]
          : []
      }),
    ),
})

/** Đăng nhập: Client Secret của Google chỉ nằm trong Supabase, không bao giờ lưu ở đây. */
export const authOptionsSchema = z.object({
  allow_self_signup: z.boolean().catch(false),
  google_enabled: z.boolean().catch(false),
  google_client_id: text,
  captcha_enabled: z.boolean().catch(false),
  captcha_site_key: text,
})

export type AuthOptions = z.infer<typeof authOptionsSchema>
export type SiteChrome = z.infer<typeof siteChromeSchema>
export type SchoolIdentity = z.infer<typeof schoolIdentitySchema>
export type Branding = z.infer<typeof brandingSchema>
export type Marquee = z.infer<typeof marqueeSchema>

export interface SiteSettings {
  identity: SchoolIdentity
  branding: Branding
  marquee: Marquee
  chrome: SiteChrome
  authOptions: AuthOptions
  homepage: HomepageSettings
  modules: Record<string, boolean>
}

export const SITE_SETTINGS_QUERY_KEY = ['site-settings'] as const

export const MODULE_KEYS = [
  'news',
  'announcements',
  'documents',
  'albums',
  'videos',
  'resources',
  'plans',
  'comments',
  'pages',
  'topics',
] as const
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
    chrome: siteChromeSchema.parse(byKey.get('site_chrome') ?? {}),
    authOptions: authOptionsSchema.parse(byKey.get('auth_options') ?? {}),
    homepage: homepageSchema.parse(byKey.get('homepage') ?? {}),
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
