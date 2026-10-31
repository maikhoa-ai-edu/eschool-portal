import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Newspaper, Search } from 'lucide-react'
import {
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
  WithSidebar,
  type Crumb,
} from '@/components/content/PublicPage'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { usePageTitle } from '@/lib/use-page-title'
import {
  fetchCategories,
  fetchPublicNews,
  fetchTagName,
  NEWS_KEY,
  NEWS_PAGE_SIZE,
  searchPublicNews,
  type PublicNewsCard,
} from '../api'

export function NewsCard({ news, priority = false }: { news: PublicNewsCard; priority?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md sm:flex-row">
      <Link
        to={`/tin-tuc/${news.slug}`}
        className="block aspect-video shrink-0 overflow-hidden bg-bg sm:w-64"
        tabIndex={-1}
        aria-hidden
      >
        {news.thumbnail_url ? (
          <img
            src={resolveMediaUrl(news.thumbnail_url)!}
            {...responsiveImage(news.thumbnail_url, '(min-width: 640px) 240px, 100vw')}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-muted">
            <Newspaper className="h-10 w-10" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {news.category && (
          <Link
            to={`/tin-tuc/chuyen-muc/${news.category.slug}`}
            className="text-xs font-semibold uppercase text-accent hover:underline"
          >
            {news.category.name}
          </Link>
        )}
        <h2 className="text-lg font-bold leading-snug">
          <Link to={`/tin-tuc/${news.slug}`} className="hover:text-primary">
            {news.title}
          </Link>
        </h2>
        {news.excerpt && <p className="line-clamp-3 text-sm text-muted">{news.excerpt}</p>}
        <p className="mt-auto flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatDate(news.published_at)}
        </p>
      </div>
    </article>
  )
}

export function CategoryList({ activeSlug }: { activeSlug?: string }) {
  const { data = [] } = useQuery({ queryKey: [...NEWS_KEY, 'categories'], queryFn: fetchCategories })
  const visible = data.filter((c) => c.is_active)
  if (visible.length === 0) return null
  return (
    <SidebarBox title="Chuyên mục">
      <ul className="space-y-1 text-sm">
        <li>
          <Link
            to="/tin-tuc"
            className={cn(
              'block rounded px-2 py-1.5 hover:bg-bg',
              !activeSlug && 'font-semibold text-primary',
            )}
          >
            Tất cả tin tức
          </Link>
        </li>
        {visible.map((c) => (
          <li key={c.id}>
            <Link
              to={`/tin-tuc/chuyen-muc/${c.slug}`}
              aria-current={c.slug === activeSlug ? 'page' : undefined}
              className={cn(
                'block rounded px-2 py-1.5 hover:bg-bg',
                c.slug === activeSlug && 'font-semibold text-primary',
              )}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </SidebarBox>
  )
}

function SearchBox({ initial }: { initial: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initial)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const q = value.trim()
    navigate(q ? `/tin-tuc?q=${encodeURIComponent(q)}` : '/tin-tuc')
  }
  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm bài viết (gõ có dấu hoặc không dấu)..."
        aria-label="Tìm bài viết"
        className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
      />
      <button type="submit" className={buttonClasses('primary')}>
        <Search className="h-4 w-4" aria-hidden /> Tìm
      </button>
    </form>
  )
}

/** /tin-tuc, /tin-tuc/chuyen-muc/:slug, /tin-tuc/the/:slug và tìm kiếm ?q= */
export function NewsListPage({ mode = 'all' }: { mode?: 'all' | 'category' | 'tag' }) {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const page = readPage(params)
  const q = mode === 'all' ? (params.get('q') ?? '').trim() : ''

  const categories = useQuery({ queryKey: [...NEWS_KEY, 'categories'], queryFn: fetchCategories })
  const list = useQuery({
    queryKey: [...NEWS_KEY, 'public', { mode, slug, page, q }],
    queryFn: async () => {
      if (q) {
        const items = await searchPublicNews(q)
        return { items, total: items.length }
      }
      return fetchPublicNews({
        page,
        categorySlug: mode === 'category' ? slug : undefined,
        tagSlug: mode === 'tag' ? slug : undefined,
      })
    },
  })

  const tagName = useQuery({
    queryKey: [...NEWS_KEY, 'tag-name', slug],
    queryFn: () => fetchTagName(slug!),
    enabled: mode === 'tag' && Boolean(slug),
  })

  const category = mode === 'category' ? categories.data?.find((c) => c.slug === slug) : undefined
  const title =
    mode === 'category'
      ? (category?.name ?? 'Chuyên mục')
      : mode === 'tag'
        ? `Thẻ: ${tagName.data ?? slug ?? ''}`
        : q
          ? `Kết quả tìm kiếm "${q}"`
          : 'Tin tức'
  usePageTitle(title)

  const crumbs: Crumb[] =
    mode === 'all' && !q ? [{ label: 'Tin tức' }] : [{ label: 'Tin tức', to: '/tin-tuc' }, { label: title }]

  return (
    <WithSidebar sidebar={<CategoryList activeSlug={mode === 'category' ? slug : undefined} />}>
      <PublicPageHeader title={title} crumbs={crumbs}>
        {category?.description && <p className="text-muted">{category.description}</p>}
      </PublicPageHeader>
      <div className="mb-5">
        <SearchBox key={q} initial={q} />
      </div>
      <PublicQueryState isPending={list.isPending} error={list.error} />
      {list.data && list.data.items.length === 0 && (
        <EmptyState icon={Newspaper} title={q ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết'}>
          {q && 'Thử từ khóa ngắn hơn hoặc kiểm tra lại chính tả.'}
        </EmptyState>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="space-y-4">
          {q && <p className="text-sm text-muted">Tìm thấy {list.data.total} bài viết.</p>}
          {list.data.items.map((n, i) => (
            <NewsCard key={n.id} news={n} priority={i === 0} />
          ))}
          {!q && <Pagination page={page} totalPages={Math.ceil(list.data.total / NEWS_PAGE_SIZE)} />}
        </div>
      )}
    </WithSidebar>
  )
}

export function CategoryNewsPage() {
  return <NewsListPage mode="category" />
}

export function TagNewsPage() {
  return <NewsListPage mode="tag" />
}
