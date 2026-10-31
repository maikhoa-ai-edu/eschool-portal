import { createContext } from 'react'
import {
  resolveColumns,
  resolveVariant,
  type HomepageSection,
  type HomepageSettings,
  type HomepageZone,
} from '@/features/site/homepage-settings'

/** Kiểu tiêu đề khối của trang đang hiển thị (cấu hình đã lưu hoặc bản nháp đang xem trước). */
export const HeadingStyleContext = createContext<HomepageSettings['heading_style']>('underline')

/** Số bài ở cột Tiêu điểm cạnh slide; màn hình nhỏ hơn xl chỉ đủ chỗ cho 3 bài. */
export const HERO_RAIL_COUNT = 4
/** Kiểu đầu trang đầy đủ: cột phải cao bằng slide + dải tin nên đủ chỗ cho 5 bài */
export const PORTAL_RAIL_COUNT = 5
/** Số bài của dải tin trượt dưới slide (hiện 4 bài trên máy tính, phần còn lại trượt ngang) */
export const HERO_STRIP_COUNT = 8

export function railCount(hero: HomepageSettings['hero']): number {
  if (hero === 'portal') return PORTAL_RAIL_COUNT
  return hero === 'split' ? HERO_RAIL_COUNT : 0
}

/** Độ rộng tối đa (px) của từng vùng khi đủ chỗ: khung 1280 - lề 32; cột phải 320; khe giữa hai cột 32. */
const ZONE_WIDTH: Record<HomepageZone, number> = { top: 1248, bottom: 1248, main: 896, sidebar: 320 }

export function blockWidth(zone: HomepageZone, half: boolean): number {
  const width = ZONE_WIDTH[zone]
  return half ? Math.floor((width - 32) / 2) : width
}

function sizes(desktopPx: number, tabletVw: number, mobileVw: number): string {
  return `(min-width: 1024px) ${Math.round(desktopPx)}px, (min-width: 768px) ${Math.round(tabletVw)}vw, ${Math.round(mobileVw)}vw`
}

/** Khối hẹp hơn các mức này thì xếp chồng (khớp @xl và @2xl trong NewsBlock). */
const SPOTLIGHT_SPLIT_AT = 576
const MAGAZINE_SPLIT_AT = 672

/** Thuộc tính sizes của ảnh trong khối tin, theo vùng + độ rộng + kiểu. Thẻ nhỏ cỡ cố định dùng số px. */
export function newsImageSizes(section: HomepageSection): { big: string; small: string } {
  const { zone, half } = section
  const width = blockWidth(zone, half)
  const tablet = half ? 50 : 100
  switch (resolveVariant(section)) {
    case 'spotlight': {
      const split = width >= SPOTLIGHT_SPLIT_AT
      return {
        big: sizes(split ? width * 0.6 : width, split ? tablet * 0.6 : tablet, 100),
        small: '112px',
      }
    }
    case 'magazine': {
      const big = width >= MAGAZINE_SPLIT_AT ? 0.5 : 1
      return {
        big: sizes(width * big, tablet * big, 100),
        small: sizes((width * big) / 2, (tablet * big) / 2, 50),
      }
    }
    case 'grid': {
      const columns = resolveColumns(section)
      const card = sizes(width / columns, tablet / Math.min(columns, 3), 50)
      return { big: card, small: card }
    }
    case 'image_list':
      return { big: '160px', small: '160px' }
    case 'compact':
      return { big: '', small: '' }
  }
}

/** Lớp cột của lưới: điện thoại luôn 2 cột, tăng dần theo độ rộng khối (container query). */
export const GRID_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 @2xl:grid-cols-3',
  4: 'grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4',
}

/** sizes của ảnh banner toàn khối. */
export function bannerImageSizes(zone: HomepageZone, half: boolean): string {
  return half ? sizes(blockWidth(zone, half), 50, 100) : '(min-width: 1280px) 1248px, 100vw'
}
