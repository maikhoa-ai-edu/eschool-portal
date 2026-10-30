import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import { DraftPreviewNotice, PublicPageHeader, PublicQueryState } from '@/components/content/PublicPage'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import { ALBUM_PAGE_SIZE, ALBUMS_KEY, fetchPublicAlbum, fetchPublicAlbums, type AlbumImage } from '../api'

export function AlbumListPage() {
  const [params] = useSearchParams()
  const page = readPage(params)
  usePageTitle('Thư viện ảnh')
  const { data, isPending, error } = useQuery({
    queryKey: [...ALBUMS_KEY, 'public', page],
    queryFn: () => fetchPublicAlbums(page),
  })

  return (
    <div>
      <PublicPageHeader title="Thư viện ảnh" crumbs={[{ label: 'Thư viện ảnh' }]} />
      <PublicQueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState icon={Images} title="Chưa có album ảnh" />}
      {data && data.items.length > 0 && (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((album) => (
              <li key={album.id}>
                <Link
                  to={`/thu-vien-anh/${album.slug}`}
                  className="group block overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted">
                        <Images className="h-10 w-10" aria-hidden />
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                      <Images className="h-3.5 w-3.5" aria-hidden /> {album.imageCount}
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold leading-snug group-hover:text-primary">{album.title}</h2>
                    {album.event_date && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatDate(album.event_date)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(data.total / ALBUM_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}

/** Xem ảnh phóng to: phím ← → để chuyển ảnh, Esc để đóng. */
function Lightbox({
  images,
  index,
  onChange,
  onClose,
}: {
  images: AlbumImage[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
}) {
  const image = images[index]!
  const go = useCallback(
    (delta: number) => onChange((index + delta + images.length) % images.length),
    [index, images.length, onChange],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [go, onClose])

  const control =
    'absolute flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30'
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh ${index + 1}/${images.length}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        className={`${control} right-4 top-4`}
        aria-label="Đóng"
        onClick={onClose}
        autoFocus
      >
        <X className="h-6 w-6" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className={`${control} left-2 sm:left-6`}
            aria-label="Ảnh trước"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className={`${control} right-2 sm:right-6`}
            aria-label="Ảnh sau"
            onClick={() => go(1)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <img
        src={image.url}
        alt={image.caption ?? image.title}
        className="max-h-[80vh] max-w-full rounded object-contain"
      />
      <p className="mt-3 text-center text-sm text-white/90">
        {image.caption && <span className="mr-2">{image.caption}</span>}
        <span className="text-white/60">
          {index + 1}/{images.length}
        </span>
      </p>
    </div>
  )
}

export function AlbumDetailPage() {
  const { slug = '' } = useParams()
  const [open, setOpen] = useState<number | null>(null)
  const {
    data: album,
    isPending,
    error,
  } = useQuery({
    queryKey: [...ALBUMS_KEY, 'public', 'detail', slug],
    queryFn: () => fetchPublicAlbum(slug),
  })
  usePageTitle(album?.title)

  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!album) return <NotFound />

  return (
    <div>
      {album.status !== 'published' && <DraftPreviewNotice />}
      <PublicPageHeader title={album.title} crumbs={[{ label: 'Thư viện ảnh', to: '/thu-vien-anh' }]}>
        <p className="flex flex-wrap gap-x-4 text-sm text-muted">
          {album.event_date && <span>{formatDate(album.event_date)}</span>}
          <span>{album.images.length} ảnh</span>
        </p>
        {album.description && <p className="max-w-3xl text-muted">{album.description}</p>}
      </PublicPageHeader>
      {album.images.length === 0 ? (
        <EmptyState icon={Images} title="Album chưa có ảnh" />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {album.images.map((image, index) => (
            <li key={image.mediaId}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="group block aspect-square w-full overflow-hidden rounded-lg bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Xem ảnh ${index + 1}${image.caption ? `: ${image.caption}` : ''}`}
              >
                <img
                  src={image.url}
                  alt={image.caption ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open !== null && (
        <Lightbox images={album.images} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
