import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronRight, FileText, Images, Newspaper, Play, Quote, Sparkles } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
} from '@/components/content/PublicPage'
import { RichContent } from '@/components/content/RichContent'
import { fetchPublicAlbum } from '@/features/albums/api'
import { documentTypeLabel } from '@/features/documents/api'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { isExternalUrl } from '@/features/site/menu'
import { useSite } from '@/features/site/site-context'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import {
  fetchDocumentsByIds,
  fetchNewsByTag,
  fetchPublicTopic,
  fetchPublishedTopics,
  TOPICS_KEY,
} from '../api'
import { isDarkColor, youtubeId, type TopicSection } from '../sections'

type SectionOf<T extends TopicSection['type']> = Extract<TopicSection, { type: T }>

function Block({ section, children }: { section: TopicSection; children: React.ReactNode }) {
  // Cột phải dùng khung giống cột phải của trang chủ
  if (section.area === 'side' && section.title) {
    return <SidebarBox title={section.title}>{children}</SidebarBox>
  }
  return (
    <section className="space-y-4">
      {section.title && (
        <h2 className="border-b-2 border-primary/15 pb-2 text-lg font-bold uppercase text-primary">
          {section.title}
        </h2>
      )}
      {children}
    </section>
  )
}

function SmartLink({
  url,
  className,
  children,
}: {
  url: string
  className?: string
  children: React.ReactNode
}) {
  if (isExternalUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={url} className={className}>
      {children}
    </Link>
  )
}

function QuoteBlock({ section }: { section: SectionOf<'quote'> }) {
  if (!section.text.trim()) return null
  return (
    <Block section={section}>
      <figure
        className={
          section.area === 'side' && section.title
            ? ''
            : 'rounded-xl border-l-4 border-accent bg-surface p-5 shadow-sm'
        }
      >
        <Quote className="mb-2 h-6 w-6 text-accent" aria-hidden />
        <blockquote className="whitespace-pre-line text-base italic leading-relaxed">
          {section.text}
        </blockquote>
        {section.author && (
          <figcaption className="mt-3 text-right text-sm font-semibold text-primary">
            — {section.author}
          </figcaption>
        )}
      </figure>
    </Block>
  )
}

function ListBlock({ section }: { section: SectionOf<'list'> }) {
  const items = section.items.filter((i) => i.trim())
  if (items.length === 0) return null
  return (
    <Block section={section}>
      <ol className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3 text-sm font-medium leading-relaxed">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </Block>
  )
}

function CardsBlock({ section }: { section: SectionOf<'cards'> }) {
  if (section.items.length === 0) return null
  const columns = section.area === 'side' ? '' : 'sm:grid-cols-2 xl:grid-cols-3'
  return (
    <Block section={section}>
      <ul className={`grid gap-4 ${columns}`}>
        {section.items.map((card, index) => {
          const image = resolveMediaUrl(card.image_path)
          const body = (
            <>
              {image && (
                <img
                  src={image}
                  {...responsiveImage(image, '(min-width: 640px) 400px, 100vw')}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="space-y-1.5 p-4">
                <h3 className="font-semibold leading-snug group-hover:text-primary">{card.title}</h3>
                {card.text && <p className="text-sm text-muted">{card.text}</p>}
              </div>
            </>
          )
          const className = 'group block h-full overflow-hidden rounded-xl border border-border bg-surface'
          return (
            <li key={index}>
              {card.url ? (
                <SmartLink url={card.url} className={`${className} transition hover:shadow-md`}>
                  {body}
                </SmartLink>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Block>
  )
}

function NewsBlock({ section }: { section: SectionOf<'news'> }) {
  const { data = [] } = useQuery({
    queryKey: [...TOPICS_KEY, 'news', section.tag_slug, section.limit],
    queryFn: () => fetchNewsByTag(section.tag_slug, section.limit),
    enabled: Boolean(section.tag_slug),
  })
  if (data.length === 0) return null
  const columns = section.area === 'side' ? '' : 'sm:grid-cols-2'
  return (
    <Block section={section}>
      <ul className={`grid gap-4 ${columns}`}>
        {data.map((n) => {
          const image = resolveMediaUrl(n.thumbnail_url)
          return (
            <li key={n.id}>
              <Link
                to={`/tin-tuc/${n.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
              >
                {image ? (
                  <img
                    src={image}
                    {...responsiveImage(image, '(min-width: 640px) 400px, 100vw')}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-video items-center justify-center bg-bg text-muted">
                    <Newspaper className="h-8 w-8" aria-hidden />
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  {n.category && (
                    <p className="text-xs font-semibold uppercase text-accent">{n.category.name}</p>
                  )}
                  <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                    {n.title}
                  </h3>
                  {n.excerpt && <p className="line-clamp-3 text-sm text-muted">{n.excerpt}</p>}
                  <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted">
                    <CalendarDays className="h-3 w-3" aria-hidden /> {formatDate(n.published_at)}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link
        to={`/tin-tuc/the/${section.tag_slug}`}
        className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
      >
        Xem tất cả bài viết <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </Block>
  )
}

function DocumentsBlock({ section }: { section: SectionOf<'documents'> }) {
  const { data = [] } = useQuery({
    queryKey: [...TOPICS_KEY, 'documents', section.document_ids],
    queryFn: () => fetchDocumentsByIds(section.document_ids),
  })
  if (data.length === 0) return null
  return (
    <Block section={section}>
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
    </Block>
  )
}

function AlbumBlock({ section }: { section: SectionOf<'album'> }) {
  const { data } = useQuery({
    queryKey: [...TOPICS_KEY, 'album', section.album_slug],
    queryFn: () => fetchPublicAlbum(section.album_slug),
    enabled: Boolean(section.album_slug),
  })
  if (!data || data.status !== 'published' || data.images.length === 0) return null
  const columns = section.area === 'side' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
  return (
    <Block section={section}>
      <ul className={`grid gap-2 ${columns}`}>
        {data.images.slice(0, section.limit).map((image) => (
          <li key={image.mediaId}>
            <Link to={`/thu-vien-anh/${data.slug}`} className="block overflow-hidden rounded-lg">
              <img
                src={image.url}
                {...responsiveImage(image.url, '(min-width: 1024px) 240px, 50vw')}
                alt={image.caption ?? ''}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition hover:scale-105"
              />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={`/thu-vien-anh/${data.slug}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <Images className="h-4 w-4" aria-hidden /> Xem cả album
      </Link>
    </Block>
  )
}

/** Chỉ tải YouTube khi người xem bấm phát: trang nhẹ hơn, không gửi dữ liệu cho bên thứ ba nếu không xem. */
function VideoBlock({ section }: { section: SectionOf<'video'> }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(section.url)
  if (!id) return null
  const label = section.caption || section.title || 'Video'
  return (
    <Block section={section}>
      <div className="aspect-video overflow-hidden rounded-xl bg-primary">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={label}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Phát video: ${label}`}
            className="flex h-full w-full items-center justify-center text-white hover:bg-white/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger">
              <Play className="h-7 w-7" aria-hidden />
            </span>
          </button>
        )}
      </div>
      {section.caption && <p className="text-sm font-medium">{section.caption}</p>}
    </Block>
  )
}

function SectionView({ section }: { section: TopicSection }) {
  const { isModuleEnabled } = useSite()
  switch (section.type) {
    case 'rich_text':
      return section.html.trim() ? (
        <Block section={section}>
          <div className="rounded-xl bg-surface p-4 shadow-sm sm:p-6">
            <RichContent html={section.html} />
          </div>
        </Block>
      ) : null
    case 'quote':
      return <QuoteBlock section={section} />
    case 'list':
      return <ListBlock section={section} />
    case 'cards':
      return <CardsBlock section={section} />
    case 'news':
      return isModuleEnabled('news') ? <NewsBlock section={section} /> : null
    case 'documents':
      return isModuleEnabled('documents') ? <DocumentsBlock section={section} /> : null
    case 'album':
      return isModuleEnabled('albums') ? <AlbumBlock section={section} /> : null
    case 'video':
      return <VideoBlock section={section} />
  }
}

function TopicHero({ topic }: { topic: NonNullable<Awaited<ReturnType<typeof fetchPublicTopic>>> }) {
  const color = topic.hero_color ?? 'var(--brand-primary)'
  const image = resolveMediaUrl(topic.hero_image)
  // Màu trường chọn có thể sáng hoặc tối; màu thương hiệu luôn được coi là tối
  const light = topic.hero_color ? !isDarkColor(topic.hero_color) : false
  return (
    <section
      className={`relative mb-8 overflow-hidden rounded-2xl border-b-4 border-accent ${light ? 'text-text' : 'text-white'}`}
      style={{ backgroundColor: color }}
    >
      {image && (
        <img
          src={image}
          {...responsiveImage(image, '(min-width: 1280px) 1248px, 100vw')}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-10"
        />
      )}
      <div className="relative grid items-center gap-6 p-5 sm:p-8 lg:grid-cols-[3fr_2fr] lg:p-10">
        <div className="min-w-0 space-y-4">
          {topic.badge && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase text-black">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {topic.badge}
            </p>
          )}
          <h1 className="text-2xl font-bold uppercase leading-snug sm:text-4xl sm:leading-snug">
            {topic.title}
          </h1>
          {topic.summary && (
            <p className="whitespace-pre-line text-sm leading-relaxed sm:text-base">{topic.summary}</p>
          )}
        </div>
        {topic.quote_text && (
          <figure className="rounded-xl bg-black/25 p-5 text-white">
            <Quote className="mb-2 h-6 w-6 text-amber-300" aria-hidden />
            <blockquote className="whitespace-pre-line text-sm italic leading-relaxed">
              {topic.quote_text}
            </blockquote>
            {topic.quote_author && (
              <figcaption className="mt-3 text-right text-sm font-semibold text-amber-300">
                — {topic.quote_author}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  )
}

export function TopicPage() {
  const { slug = '' } = useParams()
  const {
    data: topic,
    isPending,
    error,
  } = useQuery({
    queryKey: [...TOPICS_KEY, 'public', slug],
    queryFn: () => fetchPublicTopic(slug),
  })
  usePageTitle(topic?.meta_title || topic?.title)

  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!topic) return <NotFound />

  const sections = topic.sections.filter((s) => s.enabled)
  const main = sections.filter((s) => s.area === 'main')
  const side = sections.filter((s) => s.area === 'side')

  return (
    <div>
      {topic.status !== 'published' && <DraftPreviewNotice />}
      <nav aria-label="Vị trí trang" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/" className="hover:text-primary">
          Trang chủ
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span aria-current="page">{topic.title}</span>
      </nav>
      <TopicHero topic={topic} />
      <div className={side.length > 0 ? 'grid gap-8 lg:grid-cols-[1fr_340px]' : ''}>
        <div className="min-w-0 space-y-8">
          {main.map((s) => (
            <SectionView key={s.id} section={s} />
          ))}
        </div>
        {side.length > 0 && (
          <aside className="min-w-0 space-y-5">
            {side.map((s) => (
              <SectionView key={s.id} section={s} />
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

/** /chuyen-de: một chuyên đề thì vào thẳng, nhiều thì hiện danh sách. */
export function TopicIndexPage() {
  const { data, isPending, error } = useQuery({
    queryKey: [...TOPICS_KEY, 'public', 'list'],
    queryFn: fetchPublishedTopics,
  })
  usePageTitle('Chuyên đề')
  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (data.length === 1) return <Navigate to={`/chuyen-de/${data[0]!.slug}`} replace />
  return (
    <div>
      <PublicPageHeader title="Chuyên đề" crumbs={[{ label: 'Chuyên đề' }]} />
      {data.length === 0 ? (
        <p className="text-sm text-muted">Chưa có chuyên đề nào.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => {
            const image = resolveMediaUrl(t.hero_image)
            return (
              <li key={t.id}>
                <Link
                  to={`/chuyen-de/${t.slug}`}
                  className="group block h-full overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
                >
                  {image && (
                    <img
                      src={image}
                      {...responsiveImage(image, '(min-width: 640px) 400px, 100vw')}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="space-y-1.5 p-4">
                    <h2 className="font-semibold leading-snug group-hover:text-primary">{t.title}</h2>
                    {t.summary && <p className="line-clamp-3 text-sm text-muted">{t.summary}</p>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
