import {
  groupRows,
  sectionTitle,
  SECTION_INFO,
  VARIANT_LABELS,
  type HomepageSection,
  type HomepageSettings,
  type HomepageZone,
  type NewsVariant,
} from '@/features/site/homepage-settings'
import { resolveVariant } from '@/features/site/homepage-settings'
import { cn } from '@/lib/cn'

/** Hình minh họa nhỏ của từng kiểu, vẽ bằng khối màu nên không tốn ảnh. */
export function VariantThumb({ variant }: { variant: NewsVariant }) {
  const box = 'rounded-[2px] bg-current opacity-60'
  const line = 'h-[3px] rounded-full bg-current opacity-30'
  switch (variant) {
    case 'spotlight':
      return (
        <span className="grid h-9 w-14 grid-cols-[3fr_2fr] gap-1" aria-hidden>
          <span className={box} />
          <span className="flex flex-col justify-between py-0.5">
            <span className={line} />
            <span className={line} />
            <span className={line} />
            <span className={line} />
          </span>
        </span>
      )
    case 'magazine':
      return (
        <span className="grid h-9 w-14 grid-cols-2 gap-1" aria-hidden>
          <span className={box} />
          <span className="grid grid-cols-2 gap-0.5">
            <span className={box} />
            <span className={box} />
            <span className={box} />
            <span className={box} />
          </span>
        </span>
      )
    case 'grid':
      return (
        <span className="grid h-9 w-14 grid-cols-3 grid-rows-2 gap-0.5" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={box} />
          ))}
        </span>
      )
    case 'image_list':
      return (
        <span className="flex h-9 w-14 flex-col justify-between" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <span className={cn(box, 'h-2.5 w-4 shrink-0')} />
              <span className={cn(line, 'flex-1')} />
            </span>
          ))}
        </span>
      )
    case 'compact':
      return (
        <span className="flex h-9 w-14 flex-col justify-between py-0.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={line} />
          ))}
        </span>
      )
  }
}

function blockLabel(section: HomepageSection, categoryName: (id: string | null) => string): string {
  if (section.key === 'category_news') return section.title || categoryName(section.category_id)
  return sectionTitle(section) || SECTION_INFO[section.key].label
}

/** Sơ đồ trang theo bản nháp, cập nhật ngay khi sửa (khối tắt không hiện). */
export function LayoutMap({
  settings,
  categoryName,
}: {
  settings: HomepageSettings
  categoryName: (id: string | null) => string
}) {
  const inZone = (zone: HomepageZone) => settings.sections.filter((s) => s.enabled && s.zone === zone)
  const chip = (section: HomepageSection) => (
    <span
      key={section.id}
      className="min-w-0 flex-1 truncate rounded bg-primary/10 px-2 py-1 text-xs text-primary"
    >
      {blockLabel(section, categoryName)}
      {SECTION_INFO[section.key].newsVariants && (
        <span className="text-muted"> · {VARIANT_LABELS[resolveVariant(section)]}</span>
      )}
    </span>
  )
  const rows = (zone: HomepageZone) =>
    groupRows(inZone(zone)).map((row) => (
      <div key={row[0]!.id} className="flex gap-1">
        {row.map(chip)}
      </div>
    ))
  const sidebar = inZone('sidebar')
  const zoneBox = 'space-y-1 rounded border border-dashed border-border p-1.5'
  return (
    <div className="space-y-1.5" role="img" aria-label="Sơ đồ bố cục trang chủ theo bản nháp">
      <div className={zoneBox}>
        {settings.show_slides && (
          <div className="flex gap-1">
            <span className="flex-[2] rounded bg-primary px-2 py-2 text-center text-xs text-white">
              {settings.hero === 'portal' ? 'Slide + dải tin' : 'Slide'}
            </span>
            {settings.hero !== 'full' && (
              <span className="flex-1 rounded bg-primary/60 px-2 py-2 text-center text-xs text-white">
                {settings.hero === 'portal' ? 'Tiêu điểm / Xem nhiều' : 'Tiêu điểm'}
              </span>
            )}
          </div>
        )}
        {rows('top')}
      </div>
      <div className={cn('grid gap-1.5', sidebar.length > 0 && 'grid-cols-[1fr_30%]')}>
        <div className={zoneBox}>{rows('main')}</div>
        {sidebar.length > 0 && (
          <div className={zoneBox}>
            {sidebar.map((s) => (
              <div key={s.id} className="flex">
                {chip(s)}
              </div>
            ))}
          </div>
        )}
      </div>
      {inZone('bottom').length > 0 && <div className={zoneBox}>{rows('bottom')}</div>}
    </div>
  )
}
