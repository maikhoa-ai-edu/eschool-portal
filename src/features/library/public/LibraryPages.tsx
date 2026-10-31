import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FolderDown, Video as VideoIcon } from 'lucide-react'
import { PublicPageHeader, PublicQueryState } from '@/components/content/PublicPage'
import { EmptyState } from '@/components/ui/EmptyState'
import { safeExternalUrl } from '@/features/site/settings'
import { cn } from '@/lib/cn'
import { usePageTitle } from '@/lib/use-page-title'
import {
  fetchResources,
  fetchVideos,
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
  RESOURCES_KEY,
  resourceKindLabel,
  videoEmbedUrl,
  VIDEOS_KEY,
} from '../api'
import { VideoThumb } from '../VideoThumb'

export function VideoListPage() {
  usePageTitle('Thư viện video')
  const [params] = useSearchParams()
  const { data, isPending, error } = useQuery({
    queryKey: [...VIDEOS_KEY, 'public'],
    queryFn: () => fetchVideos(true),
  })
  const items = (data ?? []).filter((v) => videoEmbedUrl(v.url))
  const current = items.find((v) => v.id === params.get('xem')) ?? items[0]
  const embed = current && videoEmbedUrl(current.url)

  return (
    <div>
      <PublicPageHeader title="Thư viện video" crumbs={[{ label: 'Video' }]} />
      <PublicQueryState isPending={isPending} error={error} />
      {data && items.length === 0 && <EmptyState icon={VideoIcon} title="Chưa có video" />}
      {current && embed && (
        <section className="mb-6 overflow-hidden rounded-xl bg-surface shadow-sm">
          <iframe
            key={current.id}
            src={embed}
            title={current.title}
            className="aspect-video w-full"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
          <div className="p-4">
            <h2 className="text-lg font-bold">{current.title}</h2>
            {current.description && <p className="mt-1 text-sm text-muted">{current.description}</p>}
          </div>
        </section>
      )}
      {items.length > 1 && (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((v) => (
            <li key={v.id}>
              <Link
                to={`/video?xem=${v.id}`}
                aria-current={v.id === current?.id ? 'true' : undefined}
                className="group block"
              >
                <VideoThumb url={v.url} />
                <span className="mt-2 line-clamp-2 block text-sm font-semibold group-hover:text-primary">
                  {v.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResourceListPage() {
  usePageTitle('Tài nguyên')
  const [params, setParams] = useSearchParams()
  const kind = params.get('loai')
  const { data, isPending, error } = useQuery({
    queryKey: [...RESOURCES_KEY, 'public'],
    queryFn: () => fetchResources(true),
  })
  const items = (data ?? []).filter((r) => safeExternalUrl(r.url) && (!kind || r.kind === kind))
  const chip = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-sm font-medium',
      active ? 'bg-primary text-white' : 'bg-surface text-text hover:bg-primary/10',
    )
  return (
    <div>
      <PublicPageHeader title="Tài nguyên" crumbs={[{ label: 'Tài nguyên' }]} />
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Lọc theo loại tài nguyên">
        <button type="button" className={chip(!kind)} aria-pressed={!kind} onClick={() => setParams({})}>
          Tất cả
        </button>
        {RESOURCE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={chip(kind === k)}
            aria-pressed={kind === k}
            onClick={() => setParams({ loai: k })}
          >
            {RESOURCE_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <PublicQueryState isPending={isPending} error={error} />
      {data && items.length === 0 && <EmptyState icon={FolderDown} title="Chưa có tài nguyên" />}
      {items.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {items.map((r) => (
            <li key={r.id} className="p-4">
              <a
                href={safeExternalUrl(r.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold hover:text-primary hover:underline"
              >
                {r.title} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <p className="text-xs text-muted">{resourceKindLabel(r.kind)}</p>
              {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
