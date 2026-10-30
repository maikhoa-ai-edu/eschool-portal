import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Eye, Tag, UserRound } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
  WithSidebar,
} from '@/components/content/PublicPage'
import { RichContent } from '@/components/content/RichContent'
import { resolveMediaUrl } from '@/features/media/api'
import { formatDate, formatNumber } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import { fetchPublicNewsBySlug, fetchRelatedNews, NEWS_KEY, recordNewsView } from '../api'
import { CategoryList } from './NewsListPage'

function RelatedNews({ categoryId, excludeId }: { categoryId: string; excludeId: string }) {
  const { data = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'related', categoryId, excludeId],
    queryFn: () => fetchRelatedNews(categoryId, excludeId),
  })
  if (data.length === 0) return null
  return (
    <SidebarBox title="Tin cùng chuyên mục">
      <ul className="space-y-3">
        {data.map((n) => (
          <li key={n.id}>
            <Link to={`/tin-tuc/${n.slug}`} className="flex gap-3 hover:text-primary">
              {n.thumbnail_url && (
                <img
                  src={resolveMediaUrl(n.thumbnail_url)!}
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

  useEffect(() => {
    if (news && isPublished) void recordNewsView(news.id)
  }, [news, isPublished])

  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!news) return <NotFound />

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
            {news.author && (
              <span className="flex items-center gap-1.5">
                <UserRound className="h-4 w-4" aria-hidden /> {news.author.full_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" aria-hidden /> {formatNumber(news.view_count)} lượt xem
            </span>
          </p>
        </PublicPageHeader>
        {news.excerpt && <p className="mb-4 font-semibold leading-relaxed">{news.excerpt}</p>}
        <RichContent html={news.content} />
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
    </WithSidebar>
  )
}
