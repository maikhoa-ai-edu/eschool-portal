import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, Eye, FileText, Images, Newspaper, Pin } from 'lucide-react'
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
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { fetchCategories, NEWS_KEY } from '@/features/news/api'
import { sectionTitle, type HomepageSection } from '@/features/site/homepage-settings'
import { fetchVisitStats, VISIT_STATS_KEY } from '@/features/site/visits'
import { formatDate, formatNumber } from '@/lib/format'
import { fetchCategoryNews, fetchLatestDocuments, fetchLatestNews, type HomeNews } from './api'
import { useFeaturedNews } from './hooks'

/** Tiêu đề khối ở cột chính: gạch màu nhấn + liên kết "Xem tất cả". */
function MainBlock({ title, more, children }: { title: string; more?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b-2 border-primary/15">
        <h2 className="-mb-0.5 border-b-2 border-accent pb-2 text-lg font-bold uppercase text-primary">
          {title}
        </h2>
        {more && (
          <Link
            to={more}
            className="mb-2 inline-flex items-center gap-0.5 text-sm text-muted hover:text-primary"
          >
            Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Thumb({ src, className, sizes }: { src: string | null; className: string; sizes: string }) {
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

function SmallNews({ news }: { news: HomeNews }) {
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

function BigNews({ news }: { news: HomeNews }) {
  return (
    <Link to={`/tin-tuc/${news.slug}`} className="group block">
      <Thumb
        src={news.thumbnail_url}
        sizes="(min-width: 768px) 480px, 100vw"
        className="aspect-video w-full rounded-xl"
      />
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

export function FeaturedNews({ section }: { section: HomepageSection }) {
  const { data = [] } = useFeaturedNews(section.limit, true)
  if (data.length === 0) return null
  const [first, ...rest] = data
  return (
    <MainBlock title={sectionTitle(section)} more="/tin-tuc">
      <div className="grid gap-5 rounded-xl bg-surface p-4 shadow-sm md:grid-cols-[3fr_2fr]">
        <BigNews news={first!} />
        {rest.length > 0 && (
          <ul className="space-y-4">
            {rest.map((n) => (
              <li key={n.id}>
                <SmallNews news={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </MainBlock>
  )
}

/** Tin mới nhất, bỏ các bài đã hiện ở khối "Tin nổi bật" (nếu khối đó đang bật). */
export function LatestNews({ section, excludeIds }: { section: HomepageSection; excludeIds: string[] }) {
  const { data = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'home', 'latest', section.limit + excludeIds.length],
    queryFn: () => fetchLatestNews(section.limit + excludeIds.length),
  })
  const items = data.filter((n) => !excludeIds.includes(n.id)).slice(0, section.limit)
  if (items.length === 0) return null
  return (
    <MainBlock title={sectionTitle(section)} more="/tin-tuc">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              to={`/tin-tuc/${n.slug}`}
              className="group block h-full overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
            >
              <Thumb
                src={n.thumbnail_url}
                sizes="(min-width: 1280px) 300px, 50vw"
                className="aspect-video w-full"
              />
              <div className="space-y-1 p-2.5 sm:space-y-1.5 sm:p-3">
                {n.category && (
                  <p className="text-xs font-semibold uppercase text-accent">{n.category.name}</p>
                )}
                <h3 className="line-clamp-3 text-sm font-semibold leading-snug group-hover:text-primary sm:text-base">
                  {n.title}
                </h3>
                <p className="text-xs text-muted">{formatDate(n.published_at)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </MainBlock>
  )
}

function CategoryBlock({
  categoryId,
  name,
  slug,
  limit,
}: {
  categoryId: string
  name: string
  slug: string
  limit: number
}) {
  const { data = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'home', 'category', categoryId, limit],
    queryFn: () => fetchCategoryNews(categoryId, limit),
  })
  if (data.length === 0) return null
  const [first, ...rest] = data
  return (
    <MainBlock title={name} more={`/tin-tuc/chuyen-muc/${slug}`}>
      <div className="grid gap-5 md:grid-cols-2">
        <BigNews news={first!} />
        <ul className="space-y-4">
          {rest.map((n) => (
            <li key={n.id}>
              <SmallNews news={n} />
            </li>
          ))}
        </ul>
      </div>
    </MainBlock>
  )
}

export function CategoryNews({ section, categoryIds }: { section: HomepageSection; categoryIds: string[] }) {
  const { data: categories = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'categories'],
    queryFn: fetchCategories,
  })
  const chosen = categoryIds
    .map((id) => categories.find((c) => c.id === id && c.is_active))
    .filter((c) => c !== undefined)
  return (
    <>
      {chosen.map((c) => (
        <CategoryBlock
          key={c.id}
          categoryId={c.id}
          name={section.title ? `${section.title}: ${c.name}` : c.name}
          slug={c.slug}
          limit={section.limit}
        />
      ))}
    </>
  )
}

export function AlbumsBlock({ section }: { section: HomepageSection }) {
  const { data } = useQuery({ queryKey: [...ALBUMS_KEY, 'public', 1], queryFn: () => fetchPublicAlbums(1) })
  const items = (data?.items ?? []).slice(0, section.limit)
  if (items.length === 0) return null
  return (
    <MainBlock title={sectionTitle(section)} more="/thu-vien-anh">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                    {...responsiveImage(album.coverUrl, '(min-width: 1024px) 240px, 50vw')}
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
    </MainBlock>
  )
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
    <SidebarBox title={sectionTitle(section)}>
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
    <SidebarBox title={sectionTitle(section)}>
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
    <SidebarBox title={sectionTitle(section)}>
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
