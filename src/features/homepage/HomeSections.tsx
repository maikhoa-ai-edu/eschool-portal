import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Eye, FileText, Images, Pin } from 'lucide-react'
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
import { responsiveImage } from '@/features/media/api'
import { fetchCategories, NEWS_KEY } from '@/features/news/api'
import { categoryTitle, sectionTitle, type HomepageSection } from '@/features/site/homepage-settings'
import { fetchMenu, hideDisabledModules, isExternalUrl } from '@/features/site/menu'
import { MenuIcon } from '@/features/site/menu-icons'
import { useSite } from '@/features/site/site-context'
import { fetchVisitStats, VISIT_STATS_KEY } from '@/features/site/visits'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import { fetchCategoryNews, fetchLatestDocuments, fetchLatestNews, type HomeNews } from './api'
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

export function AlbumsBlock({ section }: { section: HomepageSection }) {
  const { data, isPending } = useQuery({
    queryKey: [...ALBUMS_KEY, 'public', 1],
    queryFn: () => fetchPublicAlbums(1),
  })
  const items = (data?.items ?? []).slice(0, section.limit)
  if (isPending) return <BlockSkeleton className="h-48" />
  if (items.length === 0) return null
  // Chưa chọn số cột: giữ lưới gốc, trừ khi khối chỉ rộng nửa trang
  const columns = section.columns ?? (section.half ? 2 : null)
  const sizes = columns
    ? `(min-width: 1024px) ${Math.round(blockWidth(section.zone, section.half) / columns)}px, 50vw`
    : '(min-width: 1024px) 240px, 50vw'
  return (
    <MainBlock title={sectionTitle(section)} more="/thu-vien-anh" icon={section.icon}>
      <div className="@container">
        <ul className={cn('grid gap-3', columns ? GRID_CLASSES[columns] : 'grid-cols-2 lg:grid-cols-4')}>
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
    </MainBlock>
  )
}

/** Tên lớp phải viết đủ để Tailwind quét được. */
const SHORTCUT_COLUMNS: Record<number, string> = {
  1: '@2xl:grid-cols-1',
  2: '@2xl:grid-cols-2',
  3: '@2xl:grid-cols-3',
  4: '@2xl:grid-cols-4',
  5: '@2xl:grid-cols-3 @5xl:grid-cols-5',
  6: '@2xl:grid-cols-3 @5xl:grid-cols-6',
}

/** Lưới ô icon + tên, dữ liệu từ menu "shortcuts". Mục trỏ tới module đang tắt tự ẩn. */
export function ShortcutsBlock({ section }: { section: HomepageSection }) {
  const { isModuleEnabled } = useSite()
  const { data, isPending } = useQuery({
    queryKey: ['menu', 'shortcuts'],
    queryFn: () => fetchMenu('shortcuts'),
  })
  const items = hideDisabledModules(data ?? [], isModuleEnabled).slice(0, SHORTCUTS_MAX_ITEMS)
  if (isPending) return <BlockSkeleton className="h-44 @2xl:h-20" />
  if (items.length === 0) return null
  const tile =
    'group flex h-full items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-primary hover:shadow-md sm:p-4'
  const grid = (
    <div className="@container">
      <ul className={cn('grid grid-cols-2 gap-3 sm:gap-4', SHORTCUT_COLUMNS[items.length])}>
        {items.map((item) => {
          const body = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                <MenuIcon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-snug">{item.title}</span>
            </>
          )
          return (
            <li key={item.id}>
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
    </div>
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

export function AnnouncementsBox({ section }: { section: HomepageSection }) {
  const { data } = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'home', section.limit],
    queryFn: () => fetchPublicAnnouncements(1, section.limit),
  })
  const items = data?.items ?? []
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thông báo.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => {
            const p = asPriority(a.priority)
            return (
              <li key={a.id} className="py-2.5 first:pt-0">
                <Link to={`/thong-bao/${a.id}`} className="group block">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {a.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" aria-label="Ghim" />}
                    {p !== 'normal' && <Badge tone={PRIORITY_TONES[p]}>{PRIORITY_LABELS[p]}</Badge>}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold leading-snug group-hover:text-primary">
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

export function DocumentsBox({ section }: { section: HomepageSection }) {
  const { data = [] } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'home', section.limit],
    queryFn: () => fetchLatestDocuments(section.limit),
  })
  return (
    <SidebarBox title={sectionTitle(section)} icon={boxIcon(section)}>
      {data.length === 0 ? (
        <p className="text-sm text-muted">Chưa có văn bản.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => (
            <li key={d.id}>
              <Link to={`/van-ban/${d.id}`} className="group flex gap-2.5">
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
      )}
      <SideMore to="/van-ban" />
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
