/** Tiện ích màu cho bước nhận diện: màu phụ tự tính từ màu chủ đạo, cảnh báo tương phản. */

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Đổi độ sáng (theo HSL) thêm `delta` điểm phần trăm, vd #002B66 +8 -> #003C8F. */
export function adjustLightness(hex: string, delta: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  return rgbToHex(...hslToRgb(h, s, Math.max(0, Math.min(100, l + delta))))
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Tỉ lệ tương phản WCAG giữa hai màu (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

export interface ColorPreset {
  name: string
  primary: string
  accent: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Xanh dương', primary: '#002B66', accent: '#D97706' },
  { name: 'Xanh lá', primary: '#14532D', accent: '#CA8A04' },
  { name: 'Xanh ngọc', primary: '#115E59', accent: '#EA580C' },
  { name: 'Đỏ đô', primary: '#7F1D1D', accent: '#B45309' },
  { name: 'Tím', primary: '#4C1D95', accent: '#DB2777' },
]
