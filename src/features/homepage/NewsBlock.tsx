import { useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react'
import { SidebarBox } from '@/components/content/PublicPage'
import { responsiveImage, resolveMediaUrl } from '@/features/media/api'
import {
  resolveColumns,
  resolveVariant,
  type HomepageSection,
  type HomepageSettings,
  type NewsVariant,
} from '@/features/site/homepage-settings'
import { MenuIcon } from '@/features/site/menu-icons'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { fetchMostViewedNews, HOMEPAGE_KEY, type HomeNews } from './api'
import { GRID_CLASSES, HeadingStyleContext, newsImageSizes, PORTAL_RAIL_COUNT } from './layout'

/**
 * Khung một khối ở vùng rộng. Gạch chân: tiêu đề gạch màu nhấn. Thanh màu: tiêu đề trên nền màu chính, thân có viền.
 * `framed`: thân khối cần nền trắng (kiểu không có thẻ riêng).
 */
export function MainBlock({
  title,
  more,
  icon,
  framed = false,
  children,
}: {
  title: string
  more?: string
  icon?: string | null
  framed?: boolean
  children: ReactNode
}) {
  const style = useContext(HeadingStyleContext)
  const iconNode = icon && <MenuIcon name={icon} className="h-5 w-5 shrink-0" />
  if (style === 'bar') {
    return (
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b-2 border-accent bg-primary px-4 py-2.5 text-white">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold uppercase sm:text-base">
            {iconNode}
            {title}
          </h2>
          {more && (
            <Link
              to={more}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs text-white/90 hover:text-white sm:text-sm"
            >
              Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
        <div className="p-3 sm:p-4">{children}</div>
      </section>
    )
  }
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b-2 border-primary/15">
        <h2 className="-mb-0.5 flex min-w-0 items-center gap-2 border-b-2 border-accent pb-2 text-lg font-bold uppercase text-primary">
          {iconNode}
          {title}
        </h2>
        {more && (
          <Link
            to={more}
            className="mb-2 inline-flex shrink-0 items-center gap-0.5 text-sm text-muted hover:text-primary"
          >
            Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {framed ? <div className="rounded-xl bg-surface p-4 shadow-sm">{children}</div> : children}
    </section>
  )
}

export function Thumb({ src, className, sizes }: { src: string | null; className: string; sizes: string }) {
  const url = resolveMediaUrl(src)
  return url ? (
    <img
      src={url}
      {...responsiveImage(src, sizes)}
      alt=""
      loading="lazy"
      className={`${className} object-cover`}
    />
  ) : (
    <span className={`${className} flex items-center justify-center bg-bg text-muted`}>
      <Newspaper className="h-8 w-8" aria-hidden />
    </span>
  )
}

export function SmallNews({ news }: { news: HomeNews }) {
  return (
    <Link to={`/tin-tuc/${news.slug}`} className="group flex gap-3">
      <Thumb
        src={news.thumbnail_url}
        sizes="112px"
        className="h-16 w-24 shrink-0 rounded-md sm:h-[72px] sm:w-28"
      />
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
          {news.title}
        </span>
        <span className="mt-1 flex items-center gap-1 text-xs text-muted">
          <CalendarDays className="h-3 w-3" aria-hidden /> {formatDate(news.published_at)}
        </span>
      </span>
    </Link>
  )
}

function BigNews({ news, sizes }: { news: HomeNews; sizes: string }) {
  return (
    <Link to={`/tin-tuc/${news.slug}`} className="group block">
      <Thumb src={news.thumbnail_url} sizes={sizes} className="aspect-video w-full rounded-xl" />
      {news.category && (
        <p className="mt-3 text-xs font-semibold uppercase text-accent">{news.category.name}</p>
      )}
      <h3 className="mt-1 text-xl font-bold leading-snug group-hover:text-primary">{news.title}</h3>
      {news.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{news.excerpt}</p>}
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatDate(news.published_at)}
      </p>
    </Link>
  )
}

function SmallNewsList({ items }: { items: HomeNews[] }) {
  return (
    <ul className="space-y-4">
      {items.map((n) => (
        <li key={n.id}>
          <SmallNews news={n} />
        </li>
      ))}
    </ul>
  )
}

function GridCard({ news, sizes }: { news: HomeNews; sizes: string }) {
  return (
    <Link
      to={`/tin-tuc/${news.slug}`}
      className="group block h-full overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
    >
      <Thumb src={news.thumbnail_url} sizes={sizes} className="aspect-video w-full" />
      <div className="space-y-1 p-2.5 sm:space-y-1.5 sm:p-3">
        {news.category && <p className="text-xs font-semibold uppercase text-accent">{news.category.name}</p>}
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug group-hover:text-primary sm:text-base">
          {news.title}
        </h3>
        <p className="text-xs text-muted">{formatDate(news.published_at)}</p>
      </div>
    </Link>
  )
}

/** Thẻ nhỏ của kiểu Tạp chí: ảnh trên, tiêu đề dưới, không viền. */
function MiniCard({ news, sizes }: { news: HomeNews; sizes: string }) {
  return (
    <Link to={`/tin-tuc/${news.slug}`} className="group block">
      <Thumb src={news.thumbnail_url} sizes={sizes} className="aspect-video w-full rounded-lg" />
      <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug group-hover:text-primary">
        {news.title}
      </h3>
      <p className="mt-1 text-xs text-muted">{formatDate(news.published_at)}</p>
    </Link>
  )
}

function ImageRow({ news, sizes }: { news: HomeNews; sizes: string }) {
  return (
    <Link to={`/tin-tuc/${news.slug}`} className="group flex gap-3">
      <Thumb
        src={news.thumbnail_url}
        sizes={sizes}
        className="h-[72px] w-24 shrink-0 rounded-md @md:h-24 @md:w-40"
      />
      <span className="min-w-0">
        {news.category && (
          <span className="hidden text-xs font-semibold uppercase text-accent @md:block">
            {news.category.name}
          </span>
        )}
        <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary @md:text-base">
          {news.title}
        </span>
        {news.excerpt && (
          <span className="mt-1 hidden text-sm text-muted @lg:line-clamp-2">{news.excerpt}</span>
        )}
        <span className="mt-1 flex items-center gap-1 text-xs text-muted">
          <CalendarDays className="h-3 w-3" aria-hidden /> {formatDate(news.published_at)}
        </span>
      </span>
    </Link>
  )
}

function NewsVariantBody({ section, items }: { section: HomepageSection; items: HomeNews[] }) {
  const sizes = newsImageSizes(section)
  const [first, ...rest] = items
  switch (resolveVariant(section)) {
    case 'spotlight':
      return (
        <div className="grid gap-5 @xl:grid-cols-[3fr_2fr]">
          <BigNews news={first!} sizes={sizes.big} />
          {rest.length > 0 && <SmallNewsList items={rest} />}
        </div>
      )
    case 'magazine':
      return (
        <div className="grid gap-5 @2xl:grid-cols-2">
          <BigNews news={first!} sizes={sizes.big} />
          {rest.length > 0 && (
            <ul className="grid grid-cols-2 content-start gap-3 sm:gap-4">
              {rest.map((n) => (
                <li key={n.id}>
                  <MiniCard news={n} sizes={sizes.small} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'grid':
      return (
        <ul className={cn('grid gap-3 sm:gap-4', GRID_CLASSES[resolveColumns(section)])}>
          {items.map((n) => (
            <li key={n.id}>
              <GridCard news={n} sizes={sizes.small} />
            </li>
          ))}
        </ul>
      )
    case 'image_list':
      return (
        <ul className="grid gap-x-6 gap-y-4 @4xl:grid-cols-2">
          {items.map((n) => (
            <li key={n.id}>
              <ImageRow news={n} sizes={sizes.small} />
            </li>
          ))}
        </ul>
      )
    case 'compact':
      return (
        <ul className="-my-2 grid gap-x-6 @4xl:grid-cols-2">
          {items.map((n) => (
            <li key={n.id} className="border-b border-dashed border-border py-2 last:border-0">
              <Link to={`/tin-tuc/${n.slug}`} className="group block">
                <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                  {n.title}
                </span>
                <span className="text-xs text-muted">{formatDate(n.published_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )
  }
}

/**
 * Kiểu gốc trước Giai đoạn 8.5, giữ đúng từng lớp CSS để trường chưa chọn kiểu mới không đổi giao diện.
 * Chỉ dùng ở cột chính, toàn cột, tiêu đề gạch chân.
 */
function OriginalBody({ section, items }: { section: HomepageSection; items: HomeNews[] }) {
  const [first, ...rest] = items
  if (section.key === 'featured_news') {
    return (
      <div className="grid gap-5 rounded-xl bg-surface p-4 shadow-sm md:grid-cols-[3fr_2fr]">
        <BigNews news={first!} sizes="(min-width: 768px) 480px, 100vw" />
        {rest.length > 0 && <SmallNewsList items={rest} />}
      </div>
    )
  }
  if (section.key === 'latest_news') {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {items.map((n) => (
          <li key={n.id}>
            <GridCard news={n} sizes="(min-width: 1280px) 300px, 50vw" />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <BigNews news={first!} sizes="(min-width: 768px) 480px, 100vw" />
      <SmallNewsList items={rest} />
    </div>
  )
}

function isOriginalLook(section: HomepageSection, style: HomepageSettings['heading_style']): boolean {
  return section.variant === null && section.zone === 'main' && !section.half && style === 'underline'
}

const SKELETON_HEIGHT: Record<NewsVariant, string> = {
  spotlight: 'h-[30rem] @xl:h-96',
  magazine: 'h-[32rem] @2xl:h-96',
  grid: 'h-72',
  image_list: 'h-72',
  compact: 'h-48',
}

/** Giữ chỗ khi đang tải để nội dung bên dưới và chân trang không bị đẩy. */
export function BlockSkeleton({ className }: { className: string }) {
  return (
    <div className="@container" aria-hidden>
      <div className={cn('rounded-xl bg-primary/5', className)} />
    </div>
  )
}

/** Một khối tin: khung + kiểu hiển thị. Không có bài thì tự ẩn. */
export function NewsBlock({
  section,
  title,
  more,
  items,
  isPending,
}: {
  section: HomepageSection
  title: string
  more: string
  items: HomeNews[]
  isPending: boolean
}) {
  const style = useContext(HeadingStyleContext)
  if (isPending) return <BlockSkeleton className={SKELETON_HEIGHT[resolveVariant(section)]} />
  if (items.length === 0) return null
  if (section.zone === 'sidebar') {
    return (
      <SidebarBox
        title={title}
        icon={section.icon && <MenuIcon name={section.icon} className="h-4 w-4 shrink-0" />}
      >
        <div className="@container">
          <NewsVariantBody section={section} items={items} />
        </div>
      </SidebarBox>
    )
  }
  if (isOriginalLook(section, style)) {
    return (
      <MainBlock title={title} more={more} icon={section.icon}>
        <OriginalBody section={section} items={items} />
      </MainBlock>
    )
  }
  return (
    <MainBlock title={title} more={more} icon={section.icon} framed={resolveVariant(section) !== 'grid'}>
      <div className="@container">
        <NewsVariantBody section={section} items={items} />
      </div>
    </MainBlock>
  )
}

/** Cột Tiêu điểm cạnh slide. Từ lg trở lên cao đúng bằng slide, phần thừa bị cắt thay vì kéo giãn hàng. */
export function HeroRail({ items, isPending }: { items: HomeNews[]; isPending: boolean }) {
  return (
    <section className="min-h-[23rem] overflow-hidden rounded-2xl bg-surface p-4 shadow-sm lg:h-0 lg:min-h-full">
      <h2 className="mb-3 border-b-2 border-accent pb-2 text-base font-bold uppercase text-primary">
        Tiêu điểm
      </h2>
      {!isPending && (
        <ul className="space-y-4 max-xl:lg:[&>li:nth-child(4)]:hidden">
          {items.map((n) => (
            <li key={n.id}>
              <SmallNews news={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Cột phải của kiểu đầu trang đầy đủ: hai tab Tiêu điểm / Xem nhiều. Tab Xem nhiều chỉ tải khi được mở.
 * Từ lg trở lên cao đúng bằng slide + dải tin, phần thừa bị cắt thay vì kéo giãn hàng.
 */
export function HeroTabsRail({
  items,
  isPending,
  tabs,
}: {
  items: HomeNews[]
  isPending: boolean
  tabs: HomepageSettings['hero_tabs']
}) {
  const railTabs = [
    { label: tabs.focus_label, icon: tabs.focus_icon },
    { label: tabs.viewed_label, icon: tabs.viewed_icon },
  ]
  const [tab, setTab] = useState(0)
  const mostViewed = useQuery({
    queryKey: [...HOMEPAGE_KEY, 'most-viewed', PORTAL_RAIL_COUNT],
    queryFn: () => fetchMostViewedNews(PORTAL_RAIL_COUNT),
    enabled: tab === 1,
  })
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = 1 - tab
    setTab(next)
    document.getElementById(`hero-tab-${next}`)?.focus()
  }
  const list = tab === 0 ? items : (mostViewed.data ?? [])
  const pending = tab === 0 ? isPending : mostViewed.isPending
  return (
    <section
      aria-label="Tin tiêu điểm và xem nhiều"
      className="flex min-h-[29rem] flex-col overflow-hidden rounded-2xl bg-surface p-4 shadow-sm lg:h-0 lg:min-h-full"
    >
      <div
        role="tablist"
        aria-label="Chọn danh sách tin"
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-primary/10 p-1"
      >
        {railTabs.map(({ label, icon }, i) => (
          <button
            key={i}
            id={`hero-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={tab === i}
            aria-controls="hero-tab-panel"
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={onKeyDown}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold uppercase transition',
              tab === i ? 'bg-primary text-white shadow-sm' : 'text-primary hover:bg-primary/10',
            )}
          >
            <MenuIcon name={icon} className={cn('h-4 w-4 shrink-0', tab === i && 'text-accent')} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      <div id="hero-tab-panel" role="tabpanel" aria-labelledby={`hero-tab-${tab}`} className="min-h-0 flex-1">
        {!pending &&
          (list.length === 0 ? (
            <p className="text-sm text-muted">Chưa có bài đăng gần đây.</p>
          ) : (
            <ul className="flex h-full flex-col justify-between gap-4">
              {list.map((n) => (
                <li key={n.id}>
                  <SmallNews news={n} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  )
}

/**
 * Dải tin có ảnh dưới slide. Tự trượt một thẻ mỗi vài giây; dừng khi rê chuột, đặt focus,
 * hoặc khi người dùng bật giảm chuyển động. Luôn kéo ngang và bấm nút được.
 */
export function HeroStrip({ items, isPending }: { items: HomeNews[]; isPending: boolean }) {
  const list = useRef<HTMLUListElement>(null)
  const [hold, setHold] = useState(false)
  const scroll = (direction: 1 | -1) => {
    const el = list.current
    if (!el) return
    const step = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior })
    else el.scrollBy({ left: direction * (step + 12), behavior })
  }
  useEffect(() => {
    if (hold || items.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => scroll(1), 5000)
    return () => window.clearInterval(id)
  }, [hold, items.length])

  // Giữ chỗ khi đang tải để nội dung bên dưới không bị đẩy
  if (isPending) return <div className="mt-4 h-40 rounded-xl bg-primary/5" aria-hidden />
  if (items.length === 0) return null
  const control =
    'absolute top-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65'
  return (
    <section
      aria-label="Tin mới có ảnh"
      className="relative mt-4"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <ul ref={list} className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {items.map((n) => (
          <li
            key={n.id}
            className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2.25rem)/4)]"
          >
            <Link
              to={`/tin-tuc/${n.slug}`}
              className="group block h-full overflow-hidden rounded-xl border border-border bg-surface"
            >
              <Thumb
                src={n.thumbnail_url}
                sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw"
                className="aspect-video w-full"
              />
              <span className="block p-2">
                <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                  {n.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Tin trước"
        className={cn(control, 'left-1')}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Tin sau" className={cn(control, 'right-1')} onClick={() => scroll(1)}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  )
}
