import type { Branding, SchoolIdentity } from './settings'

/** Áp màu thương hiệu vào biến CSS (màu đã được kiểm tra là mã hex hợp lệ). */
export function applyBranding(branding: Branding, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--brand-primary', branding.primary_color)
  root.style.setProperty('--brand-primary-light', branding.primary_light_color)
  root.style.setProperty('--brand-accent', branding.accent_color)
}

export function applyDocumentIdentity(
  identity: SchoolIdentity,
  branding: Branding,
  doc: Document = document,
): void {
  doc.title = identity.school_name
  const iconHref = branding.favicon_url ?? branding.logo_url
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
