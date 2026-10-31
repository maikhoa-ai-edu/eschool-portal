import { resolveMediaUrl } from '@/features/media/api'
import type { Branding, SchoolIdentity } from './settings'

/** Áp màu thương hiệu vào biến CSS (màu đã được kiểm tra là mã hex hợp lệ). */
export function applyBranding(branding: Branding, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--brand-primary', branding.primary_color)
  root.style.setProperty('--brand-primary-light', branding.primary_light_color)
  root.style.setProperty('--brand-accent', branding.accent_color)
}

/** Tên và màu cài đặt ứng dụng theo từng trường nên manifest được dựng lúc chạy, không cần file riêng trên mỗi hosting. */
export function buildManifest(identity: SchoolIdentity, branding: Branding, origin: string) {
  return {
    name: identity.school_name,
    short_name: identity.short_name || identity.school_name,
    description: identity.slogan || identity.school_name,
    lang: 'vi',
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: branding.primary_color,
    icons: [
      { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}

function applyManifest(identity: SchoolIdentity, branding: Branding, doc: Document): void {
  const origin = doc.location?.origin
  if (!origin || origin === 'null' || typeof URL.createObjectURL !== 'function') return
  let link = doc.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = doc.createElement('link')
    link.rel = 'manifest'
    doc.head.appendChild(link)
  }
  if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href)
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(buildManifest(identity, branding, origin))], {
      type: 'application/manifest+json',
    }),
  )
}

export function applyDocumentIdentity(
  identity: SchoolIdentity,
  branding: Branding,
  doc: Document = document,
): void {
  doc.title = identity.school_name
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', branding.primary_color)
  applyManifest(identity, branding, doc)
  const iconHref = resolveMediaUrl(branding.favicon_url ?? branding.logo_url)
  if (iconHref) {
    let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = doc.createElement('link')
      link.rel = 'icon'
      doc.head.appendChild(link)
    }
    link.removeAttribute('type')
    link.href = iconHref
  }
}

/** Chữ viết tắt cho logo dự phòng khi trường chưa tải logo, vd "Trường THCS & THPT Vĩnh Phong" -> "VP". */
export function schoolInitials(name: string): string {
  const words = name
    .replace(/^trường\s+/i, '')
    .split(/\s+/)
    // Bỏ cấp học viết tắt và ký tự không phải chữ (vd "&")
    .filter((w) => /\p{L}/u.test(w) && !/^(thcs|thpt|th|mn|mg)$/i.test(w))
  const picked = words.length >= 2 ? words.slice(-2) : words
  return picked.map((w) => w.charAt(0).toUpperCase()).join('') || 'eS'
}
