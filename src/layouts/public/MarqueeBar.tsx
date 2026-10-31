import { Fragment } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { contrastRatio } from '@/features/install/color'
import { isExternalUrl } from '@/features/site/menu'
import { MenuIcon } from '@/features/site/menu-icons'
import type { MarqueeItem } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { getSupabase } from '@/lib/supabase'

async function fetchLatestTitles(): Promise<MarqueeItem[]> {
  const { data, error } = await getSupabase()
    .from('news')
    .select('title, slug')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return data.map((n) => ({ text: n.title, url: `/tin-tuc/${n.slug}` }))
}

function Items({ items, hidden }: { items: MarqueeItem[]; hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className={hidden ? 'pl-16' : undefined}>
      {items.map((item, i) => {
        const tab = hidden ? -1 : undefined
        const content = !item.url ? (
          item.text
        ) : isExternalUrl(item.url) ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={tab}
            className="hover:underline"
          >
            {item.text}
          </a>
        ) : (
          <Link to={item.url} tabIndex={tab} className="hover:underline">
            {item.text}
          </Link>
        )
        return (
          <Fragment key={`${i}-${item.text}`}>
            {i > 0 && (
              <span className="px-4 text-accent" aria-hidden>
                ★
              </span>
            )}
            {content}
          </Fragment>
        )
      })}
    </span>
  )
}

/** Dòng tin chạy; tự dừng khi người dùng bật "giảm chuyển động" hoặc rê chuột vào. */
export function MarqueeBar() {
  const { marquee, isModuleEnabled } = useSite()
  const withNews = marquee.enabled && marquee.include_latest_news && isModuleEnabled('news')
  const { data: latest = [] } = useQuery({
    queryKey: ['news', 'marquee-latest'],
    queryFn: fetchLatestTitles,
    enabled: withNews,
  })
  const items = [...marquee.items, ...(withNews ? latest : [])]
  if (!marquee.enabled || items.length === 0) return null

  const bg = marquee.bg_color
  // Chữ tự đổi trắng hoặc đen cho đọc được trên màu nền đã chọn
  const textColor = bg
    ? contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#111827')
      ? '#FFFFFF'
      : '#111827'
    : undefined

  return (
    <div className="border-b border-border bg-surface" style={bg ? { backgroundColor: bg } : undefined}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4">
        <span className="flex shrink-0 items-center gap-1 rounded bg-accent px-2 py-1 text-xs font-bold uppercase text-white">
          {marquee.icon ? (
            <MenuIcon name={marquee.icon} className="h-3.5 w-3.5" />
          ) : (
            <Zap className="h-3.5 w-3.5" aria-hidden />
          )}{' '}
          {marquee.label}
        </span>
        <div
          className="marquee relative flex-1 overflow-hidden py-2 text-sm font-medium text-primary"
          style={textColor ? { color: textColor } : undefined}
        >
          <p className="marquee-track whitespace-nowrap" style={{ animationDuration: `${marquee.speed}s` }}>
            <Items items={items} />
            <Items items={items} hidden />
          </p>
        </div>
      </div>
    </div>
  )
}
