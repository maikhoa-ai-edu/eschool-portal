import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ExternalLink, Eye, FileText, Images, Pin } from 'lucide-react'
import { SidebarBox } from '@/components/content/PublicPage'
import { Badge } from '@/components/ui/Badge'
import { ALBUMS_KEY, fetchPublicAlbums } from '@/features/albums/api'
import {
  ANNOUNCEMENTS_KEY,
  asPriority,
  fetchPublicAnnouncements,
  PRIORITY_LABELS,
  PRIORITY_TONES,
} from '@/features/announcements/api'
import { DOCUMENTS_KEY, documentTypeLabel } from '@/features/documents/api'
import {
  fetchResources,
  fetchVideos,
  RESOURCES_KEY,
  resourceKindLabel,
  videoEmbedUrl,
  VIDEOS_KEY,
} from '@/features/library/api'
import { VideoThumb } from '@/features/library/VideoThumb'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { fetchCategories, NEWS_KEY } from '@/features/news/api'
import { fetchCurrentPlan, PLANS_KEY } from '@/features/plans/api'
import { categoryTitle, sectionTitle, type HomepageSection } from '@/features/site/homepage-settings'
import { fetchMenu, hideDisabledModules, isExternalUrl } from '@/features/site/menu'
import { MenuIcon } from '@/features/site/menu-icons'
import { safeExternalUrl } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { fetchVisitStats, VISIT_STATS_KEY } from '@/features/site/visits'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import {
  fetchCategoryNews,
  fetchLatestDocuments,
  fetchLatestNews,
  type HomeNews,
  type LatestDocument,
} from './api'
import { blockWidth, GRID_CLASSES } from './layout'
import { BlockSkeleton, MainBlock, NewsBlock } from './NewsBlock'
import { SHORTCUTS_MAX_ITEMS } from './shortcuts'

export function FeaturedNews({
  section,
  items,
  isPending,
}: {
  section: HomepageSection
  items: HomeNews[]
  isPending: boolean
}) {
  return (
    <NewsBlock
      section={section}
      title={sectionTitle(section)}
      more="/tin-tuc"
      items={items}
      isPending={isPending}
    />
  )
}

/** Tin mới nhất, bỏ các bài đã hiện ở cột Tiêu điểm và khối "Tin nổi bật" (nếu đang bật). */
export function LatestNews({
  section,
  excludeIds,
  excludeCount,
  excludePending,
}: {
  section: HomepageSection
  excludeIds: string[]
  /** Số bài có thể bị bỏ, biết trước khi tải xong nên khóa truy vấn không đổi */
  excludeCount: number
  excludePending: boolean
}) {
  const { data = [], isPending } = useQuery({
    queryKey: [...NEWS_KEY, 'home', 'latest', section.limit + excludeCount],
    queryFn: () => fetchLatestNews(section.limit + excludeCount),
  })
  const items = data.filter((n) => !excludeIds.includes(n.id)).slice(0, section.limit)
  return (
    <NewsBlock
      section={section}
      title={sectionTitle(section)}
      more="/tin-tuc"
      items={items}
      isPending={isPending || excludePending}
    />
  )
}

/** Khối một chuyên mục. Chuyên mục đã xóa hoặc đang ẩn thì không hiện. */
export function CategoryNews({ section }: { section: HomepageSection }) {
  const categories = useQuery({
    queryKey: [...NEWS_KEY, 'categories'],
    queryFn: fetchCategories,
  })
  const category = categories.data?.find((c) => c.id === section.category_id && c.is_active)
  const news = useQuery({
    queryKey: [...NEWS_KEY, 'home', 'category', section.category_id, section.limit],
    queryFn: () => fetchCategoryNews(section.category_id!, section.limit),
    enabled: Boolean(category),
  })
  if (categories.data && !category) return null
  return (
    <NewsBlock
      section={section}
      title={category ? categoryTitle(section, category.name) : ''}
      more={category ? `/tin-tuc/chuyen-muc/${category.slug}` : '/tin-tuc'}
      items={news.data ?? []}
      isPending={categories.isPending || news.isPending}
    />
  )
}

type LibraryTab = 'albums' | 'videos' | 'resources'

const LIBRARY_TABS: Record<LibraryTab, { label: string; more: string }> = {
  albums: { label: 'Thư viện ảnh', more: '/thu-vien-anh' },
  videos: { label: 'Video', more: '/video' },
  resources: { label: 'Tài nguyên', more: '/tai-nguyen' },
}

/**
 * Khối Thư viện. Chỉ có album thì hiện như cũ; có thêm video hoặc tài nguyên thì thành các tab.
 * Chờ đủ dữ liệu rồi mới hiện để hàng tab không đẩy nội dung.
 */
export function AlbumsBlock({ section }: { section: HomepageSection }) {
  const { isModuleEnabled } = useSite()
  const [picked, setPicked] = useState<LibraryTab | null>(null)
  const withAlbums = isModuleEnabled('albums')
  const withVideos = isModuleEnabled('videos')
  const withResources = isModuleEnabled('resources')
  const { data, isPending } = useQuery({
    queryKey: [...ALBUMS_KEY, 'public', 1],
    queryFn: () => fetchPublicAlbums(1),
    enabled: withAlbums,
  })
  const videos = useQuery({
    queryKey: [...VIDEOS_KEY, 'home', section.limit],
    queryFn: () => fetchVideos(true, section.limit),
    enabled: withVideos,
  })
  const resources = useQuery({
    queryKey: [...RESOURCES_KEY, 'home', section.limit],
    queryFn: () => fetchResources(true, section.limit),
    enabled: withResources,
  })
  const items = (data?.items ?? []).slice(0, section.limit)
  const videoItems = (videos.data ?? []).filter((v) => videoEmbedUrl(v.url))
  const resourceItems = (resources.data ?? []).filter((r) => safeExternalUrl(r.url))
  if ((withAlbums && isPending) || (withVideos && videos.isPending) || (withResources && resources.isPending))
    return <BlockSkeleton className="h-48" />
  const tabs: LibraryTab[] = [
    ...(items.length > 0 ? (['albums'] as const) : []),
    ...(videoItems.length > 0 ? (['videos'] as const) : []),
    ...(resourceItems.length > 0 ? (['resources'] as const) : []),
  ]
  const active = picked && tabs.includes(picked) ? picked : tabs[0]
  if (!active) return null
  // Chưa chọn số cột: giữ lưới gốc, trừ khi khối chỉ rộng nửa trang
  const columns = section.columns ?? (section.half ? 2 : null)
  const sizes = columns
    ? `(min-width: 1024px) ${Math.round(blockWidth(section.zone, section.half) / columns)}px, 50vw`
    : '(min-width: 1024px) 240px, 50vw'
  const grid = columns ? GRID_CLASSES[columns] : 'grid-cols-2 lg:grid-cols-4'
  const hasTabs = tabs.length > 1
  return (
    <MainBlock
      title={hasTabs ? section.title || 'Thư viện' : section.title || LIBRARY_TABS[active].label}
      more={LIBRARY_TABS[active].more}
      icon={section.icon}
    >
      {hasTabs && (
        <div role="tablist" aria-label="Chọn thư viện" className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === active}
              onClick={() => setPicked(tab)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                tab === active ? 'bg-primary text-white' : 'bg-bg hover:bg-primary/10',
              )}
            >
              {LIBRARY_TABS[tab].label}
            </button>
          ))}
        </div>
      )}
      {active === 'videos' && (
        <div className="@container">
          <ul className={cn('grid gap-3', grid)}>
            {videoItems.map((v) => (
              <li key={v.id}>
                <Link to={`/video?xem=${v.id}`} className="group block">
                  <VideoThumb url={v.url} />
                  <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-snug group-hover:text-primary">
                    {v.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {active === 'resources' && (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {resourceItems.map((r) => (
            <li key={r.id} className="border-b border-dashed border-border py-2">
              <a
                href={safeExternalUrl(r.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2"
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug group-hover:text-primary">
                    {r.title}
                  </span>
                  <span className="text-xs text-muted">{resourceKindLabel(r.kind)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {active === 'albums' && (
        <div className="@container">
          <ul className={cn('grid gap-3', grid)}>
            {items.map((album) => (
              <li key={album.id}>
                <Link
                  to={`/thu-vien-anh/${album.slug}`}
                  className="group relative block overflow-hidden rounded-xl"
                >
                  <div className="aspect-[4/3] bg-bg">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        {...responsiveImage(album.coverUrl, sizes)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted">
                        <Images className="h-8 w-8" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-white">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{album.title}</p>
                    <p className="text-xs text-white/80">{album.imageCount} ảnh</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </MainBlock>
  )
}

/**
 * Một hàng ô, dữ liệu từ menu "shortcuts"; mỗi ô có ảnh/logo hoặc icon. Ô giãn đều khi đủ chỗ,
 * hẹp quá thì vuốt ngang chứ không xuống dòng. Mục trỏ tới module đang tắt tự ẩn.
 */
export function ShortcutsBlock({ section }: { section: HomepageSection }) {
  const { isModuleEnabled } = useSite()
  const { data, isPending } = useQuery({
    queryKey: ['menu', 'shortcuts'],
    queryFn: () => fetchMenu('shortcuts'),
  })
  const items = hideDisabledModules(data ?? [], isModuleEnabled).slice(
    0,
    Math.min(section.limit, SHORTCUTS_MAX_ITEMS),
  )
  if (isPending) return <BlockSkeleton className="h-20" />
  if (items.length === 0) return null
  const tile =
    'group flex h-full items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 transition hover:border-primary hover:bg-primary/10 hover:shadow-md sm:p-4'
  const grid = (
    <ul className="flex snap-x gap-3 overflow-x-auto [scrollbar-width:thin] sm:gap-4">
      {items.map((item) => {
        const image = resolveMediaUrl(item.image_path)
        const body = (
          <>
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                <MenuIcon name={item.icon} className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 text-sm font-semibold leading-snug">{item.title}</span>
          </>
        )
        return (
          <li key={item.id} className="min-w-40 flex-1 snap-start">
            {isExternalUrl(item.url) ? (
              <a
                href={item.url}
                target={item.open_in_new_tab ? '_blank' : undefined}
                rel={item.open_in_new_tab ? 'noopener noreferrer' : undefined}
                className={tile}
              >
                {body}
              </a>
            ) : (
              <Link to={item.url} className={tile}>
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
  return section.title ? (
    <MainBlock title={section.title} icon={section.icon}>
      {grid}
    </MainBlock>
  ) : (
    <nav aria-label="Lối tắt">{grid}</nav>
  )
}

function boxIcon(section: HomepageSection) {
  return section.icon && <MenuIcon name={section.icon} className="h-4 w-4 shrink-0" />
}

function SideMore({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="mt-3 inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
    >
      Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

export function AnnouncementsBox({
  section,
  highlightLatest = false,
}: {
  section: HomepageSection
  highlightLatest?: boolean
}) {
  const { data } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'home', section.limit],
    queryFn: () => fetchPublicAnnouncements(1, section.limit),
  })
  const items = data?.items ?? []
  // Danh sách xếp bài ghim lên đầu nên bài mới nhất không nhất thiết đứng đầu
  const newestId = highlightLatest
    ? items.reduce<(typeof items)[number] | null>(
        (best, a) => (!best || (a.published_at ?? '') > (best.published_at ?? '') ? a : best),
        null,
      )?.id
    : null
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thông báo.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => {
            const p = asPriority(a.priority)
            const newest = a.id === newestId
            return (
              <li
                key={a.id}
                className={cn(
                  'py-2.5 first:pt-0',
                  newest && '-mx-2 rounded-lg bg-accent/10 px-2 first:pt-2.5',
                )}
              >
                <Link to={`/thong-bao/${a.id}`} className="group block">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {newest && (
                      <span className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none text-white">
                        Mới
                      </span>
                    )}
                    {a.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" aria-label="Ghim" />}
                    {p !== 'normal' && <Badge tone={PRIORITY_TONES[p]}>{PRIORITY_LABELS[p]}</Badge>}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-sm font-semibold leading-snug group-hover:text-primary',
                      newest && 'font-bold text-primary',
                    )}
                  >
                    {a.title}
                  </span>
                  <span className="text-xs text-muted">{formatDate(a.published_at)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <SideMore to="/thong-bao" />
    </SidebarBox>
  )
}

function DocumentRows({ items, hidden }: { items: LatestDocument[]; hidden?: boolean }) {
  return (
    <ul className="space-y-3 pb-3" aria-hidden={hidden || undefined}>
      {items.map((d) => (
        <li key={d.id}>
          <Link to={`/van-ban/${d.id}`} tabIndex={hidden ? -1 : undefined} className="group flex gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                {d.title}
              </span>
              <span className="text-xs text-muted">
                {documentTypeLabel(d.document_type)}
                {d.issue_date && ` · ${formatDate(d.issue_date)}`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Dừng khi rê chuột hoặc đặt focus; giảm chuyển động thì đứng yên và cuộn được (index.css). */
function DocumentTicker({ items }: { items: LatestDocument[] }) {
  // Ít văn bản thì không đủ cao để chạy
  if (items.length < 4) return <DocumentRows items={items} />
  return (
    <div className="ticker h-72">
      <div className="ticker-track" style={{ animationDuration: `${items.length * 4}s` }}>
        <DocumentRows items={items} />
        <DocumentRows items={items} hidden />
      </div>
    </div>
  )
}

export function DocumentsBox({ section, ticker = false }: { section: HomepageSection; ticker?: boolean }) {
  const { data = [] } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'home', section.limit],
    queryFn: () => fetchLatestDocuments(section.limit),
  })
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      {data.length === 0 ? (
        <p className="text-sm text-muted">Chưa có văn bản.</p>
      ) : ticker ? (
        <DocumentTicker items={data} />
      ) : (
        <DocumentRows items={data} />
      )}
      <SideMore to="/van-ban" />
    </SidebarBox>
  )
}

/** Tự ẩn khi chưa có kế hoạch đã đăng. */
export function PlanMonthBox({ section }: { section: HomepageSection }) {
  const { data } = useQuery({
    queryKey: [...PLANS_KEY, 'home', section.limit],
    queryFn: () => fetchCurrentPlan(section.limit),
  })
  if (!data || data.items.length === 0) return null
  return (
    <SidebarBox title={`${sectionTitle(section)}`} icon={boxIcon(section)}>
      <p className="mb-2 text-xs text-muted">
        Tháng {data.plan.month}/{data.plan.year}
      </p>
      <ul className="space-y-2.5">
        {data.items.map((row, i) => (
          <li key={i} className="text-sm">
            {row.time_text && (
              <span className="block text-xs font-semibold text-accent">{row.time_text}</span>
            )}
            <span className="line-clamp-2 font-medium leading-snug">{row.content}</span>
          </li>
        ))}
      </ul>
      <SideMore to="/ke-hoach" />
    </SidebarBox>
  )
}

export function LatestVideoBox({ section }: { section: HomepageSection }) {
  const { data = [] } = useQuery({
    queryKey: [...VIDEOS_KEY, 'home-box', section.limit],
    queryFn: () => fetchVideos(true, section.limit),
  })
  const items = data.filter((v) => videoEmbedUrl(v.url))
  if (items.length === 0) return null
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      <ul className="space-y-3">
        {items.map((v) => (
          <li key={v.id}>
            <Link to={`/video?xem=${v.id}`} className="group block">
              <VideoThumb url={v.url} />
              <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-snug group-hover:text-primary">
                {v.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <SideMore to="/video" />
    </SidebarBox>
  )
}

/** Ô logo hoặc icon trỏ ra website ngoài, dữ liệu từ menu "web_links". */
export function WebLinksBox({ section }: { section: HomepageSection }) {
  const { isModuleEnabled } = useSite()
  const { data = [] } = useQuery({
    queryKey: ['menu', 'web_links'],
    queryFn: () => fetchMenu('web_links'),
  })
  const items = hideDisabledModules(data, isModuleEnabled).slice(0, section.limit)
  if (items.length === 0) return null
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      <ul className="grid gap-2">
        {items.map((item) => {
          const image = resolveMediaUrl(item.image_path)
          const external = isExternalUrl(item.url)
          const tile =
            'flex items-center gap-2.5 rounded-lg border border-primary/15 bg-primary/5 p-2 text-sm font-semibold transition hover:border-primary hover:bg-primary/10'
          const body = (
            <>
              {image ? (
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded bg-white object-contain"
                />
              ) : (
                <MenuIcon name={item.icon} className="h-5 w-5 shrink-0 text-primary" />
              )}
              <span className="min-w-0 leading-snug">{item.title}</span>
            </>
          )
          return (
            <li key={item.id}>
              {external ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className={tile}>
                  {body}
                </a>
              ) : (
                <Link to={item.url} className={tile}>
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </SidebarBox>
  )
}

export function VisitCounterBox({ section }: { section: HomepageSection }) {
  const { data } = useQuery({ queryKey: VISIT_STATS_KEY, queryFn: fetchVisitStats })
  const rows: Array<[string, number | undefined]> = [
    ['Hôm nay', data?.today],
    ['Hôm qua', data?.yesterday],
    ['Tháng này', data?.month],
  ]
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-dashed border-border pb-2">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold">{value === undefined ? '…' : formatNumber(value)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <dt className="flex items-center gap-1.5 font-semibold text-primary">
            <Eye className="h-4 w-4" aria-hidden /> Tổng lượt truy cập
          </dt>
          <dd className="text-lg font-bold text-accent">{data ? formatNumber(data.total) : '…'}</dd>
        </div>
      </dl>
    </SidebarBox>
  )
}
