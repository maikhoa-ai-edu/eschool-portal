import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, Eye, ListTree, Tag, UserRound } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
  WithSidebar,
} from '@/components/content/PublicPage'
import { NewsComments } from '@/features/comments/NewsComments'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { safeExternalUrl } from '@/features/site/settings'
import { formatDate, formatNumber } from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitize'
import { buildToc, TOC_MIN_HEADINGS, type TocHeading } from '@/lib/toc'
import { usePageTitle } from '@/lib/use-page-title'
import { fetchNewsByTags, fetchPublicNewsBySlug, fetchRelatedNews, NEWS_KEY, recordNewsView } from '../api'
import { CategoryList } from './NewsListPage'

const SIDEBAR_RELATED = 4
const BOTTOM_RELATED = 4

function useRelated(categoryId: string, excludeId: string) {
  return useQuery({
    queryKey: [...NEWS_KEY, 'related', categoryId, excludeId, SIDEBAR_RELATED + BOTTOM_RELATED],
    queryFn: () => fetchRelatedNews(categoryId, excludeId, SIDEBAR_RELATED + BOTTOM_RELATED),
  })
}

function RelatedNews({ categoryId, excludeId }: { categoryId: string; excludeId: string }) {
  const { data = [] } = useRelated(categoryId, excludeId)
  const items = data.slice(0, SIDEBAR_RELATED)
  if (items.length === 0) return null
  return (
    <SidebarBox title="Tin cùng chuyên mục">
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.id}>
            <Link to={`/tin-tuc/${n.slug}`} className="flex gap-3 hover:text-primary">
              {n.thumbnail_url && (
                <img
                  src={resolveMediaUrl(n.thumbnail_url)!}
                  {...responsiveImage(n.thumbnail_url, '96px')}
                  alt=""
                  loading="lazy"
                  className="h-14 w-20 shrink-0 rounded object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-semibold">{n.title}</span>
                <span className="text-xs text-muted">{formatDate(n.published_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SidebarBox>
  )
}

/** Cuối bài: ưu tiên bài cùng thẻ, thiếu thì lấy cùng chuyên mục; bỏ các bài đã có ở cột phải. */
function BottomRelated({
  categoryId,
  excludeId,
  tagSlugs,
}: {
  categoryId: string
  excludeId: string
  tagSlugs: string[]
}) {
  const category = useRelated(categoryId, excludeId)
  const tagged = useQuery({
    queryKey: [...NEWS_KEY, 'related-tags', excludeId, tagSlugs],
    queryFn: () => fetchNewsByTags(tagSlugs, excludeId, SIDEBAR_RELATED + BOTTOM_RELATED),
  })
  if (!category.data || !tagged.data) return null
  const sidebarIds = category.data.slice(0, SIDEBAR_RELATED).map((n) => n.id)
  const pool = [...tagged.data, ...category.data].filter(
    (n, i, all) => !sidebarIds.includes(n.id) && all.findIndex((x) => x.id === n.id) === i,
  )
  const items = pool.slice(0, BOTTOM_RELATED)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="tin-lien-quan" className="mt-6 rounded-xl bg-surface p-4 shadow-sm sm:p-6">
      <h2
        id="tin-lien-quan"
        className="mb-4 border-b-2 border-accent pb-2 text-lg font-bold uppercase text-primary"
      >
        Tin liên quan
      </h2>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((n) => (
          <li key={n.id}>
            <Link to={`/tin-tuc/${n.slug}`} className="group block">
              {n.thumbnail_url && (
                <img
                  src={resolveMediaUrl(n.thumbnail_url)!}
                  {...responsiveImage(n.thumbnail_url, '(min-width: 768px) 220px, 50vw')}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full rounded-lg object-cover"
                />
              )}
              <span className="mt-2 line-clamp-3 block text-sm font-semibold leading-snug group-hover:text-primary">
                {n.title}
              </span>
              <span className="text-xs text-muted">{formatDate(n.published_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Mở sẵn trên máy tính, thu gọn sẵn trên điện thoại; bài ít tiêu đề thì không hiện. */
function ArticleToc({ headings }: { headings: TocHeading[] }) {
  const [open, setOpen] = useState(() => !window.matchMedia?.('(max-width: 767px)').matches)
  if (headings.length < TOC_MIN_HEADINGS) return null
  return (
    <nav aria-label="Mục lục bài viết" className="mb-5 rounded-lg border border-border bg-bg p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 font-semibold text-primary"
      >
        <span className="flex items-center gap-2">
          <ListTree className="h-4 w-4" aria-hidden /> Mục lục
        </span>
        <span className="text-xs font-normal text-muted">{open ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-1 text-sm">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? 'pl-4' : undefined}>
              <a href={`#${h.id}`} className="hover:text-primary hover:underline">
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}

export function NewsDetailPage() {
  const { slug = '' } = useParams()
  const {
    data: news,
    isPending,
    error,
  } = useQuery({
    queryKey: [...NEWS_KEY, 'public', 'detail', slug],
    queryFn: () => fetchPublicNewsBySlug(slug),
  })
  const isPublished = news?.status === 'published'
  usePageTitle(news?.title)
  const toc = useMemo(() => buildToc(sanitizeHtml(news?.content ?? '')), [news?.content])

  useEffect(() => {
    if (news && isPublished) void recordNewsView(news.id)
  }, [news, isPublished])

  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!news) return <NotFound />
  const authorName = news.author_name || news.author?.full_name
  const sourceUrl = safeExternalUrl(news.source_url)

  return (
    <WithSidebar
      sidebar={
        <>
          <RelatedNews categoryId={news.category_id} excludeId={news.id} />
          <CategoryList />
        </>
      }
    >
      {!isPublished && <DraftPreviewNotice />}
      <article className="rounded-xl bg-surface p-4 shadow-sm sm:p-6">
        <PublicPageHeader
          title={news.title}
          crumbs={[
            { label: 'Tin tức', to: '/tin-tuc' },
            ...(news.category
              ? [{ label: news.category.name, to: `/tin-tuc/chuyen-muc/${news.category.slug}` }]
              : []),
          ]}
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {news.published_at && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden /> {formatDate(news.published_at)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" aria-hidden /> {formatNumber(news.view_count)} lượt xem
            </span>
          </p>
        </PublicPageHeader>
        {news.excerpt && <p className="mb-4 font-semibold leading-relaxed">{news.excerpt}</p>}
        {news.thumbnail_url && (
          <img
            src={resolveMediaUrl(news.thumbnail_url)!}
            {...responsiveImage(news.thumbnail_url, '(min-width: 1024px) 860px, 100vw')}
            alt=""
            fetchPriority="high"
            className="mb-5 aspect-video w-full rounded-lg object-cover"
          />
        )}
        <ArticleToc headings={toc.headings} />
        <div className="rich-content" dangerouslySetInnerHTML={{ __html: toc.html }} />
        {(authorName || news.source_name) && (
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {authorName && (
              <span className="flex items-center gap-1.5 font-semibold">
                <UserRound className="h-4 w-4 text-muted" aria-hidden /> {authorName}
              </span>
            )}
            {news.source_name && (
              <span className="flex items-center gap-1.5 text-muted">
                Nguồn:{' '}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {news.source_name} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : (
                  news.source_name
                )}
              </span>
            )}
          </p>
        )}
        {news.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Tag className="h-4 w-4 text-muted" aria-label="Thẻ" />
            {news.tags.map((t) => (
              <Link
                key={t.slug}
                to={`/tin-tuc/the/${t.slug}`}
                className="rounded-full bg-bg px-3 py-1 text-xs font-medium hover:bg-primary/10 hover:text-primary"
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </article>
      {isPublished && <NewsComments newsId={news.id} />}
      {isPublished && (
        <BottomRelated
          categoryId={news.category_id}
          excludeId={news.id}
          tagSlugs={news.tags.map((t) => t.slug)}
        />
      )}
    </WithSidebar>
  )
}
