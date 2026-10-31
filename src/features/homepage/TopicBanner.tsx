import { Link } from 'react-router'
import { ChevronRight, Sparkles } from 'lucide-react'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import type { HomepageBanner } from '@/features/site/homepage-settings'
import { isExternalUrl, moduleOfUrl } from '@/features/site/menu'
import { useSite } from '@/features/site/site-context'
import { isDarkColor } from '@/features/topics/sections'

/** Banner trang chủ; chưa có nội dung hoặc trỏ tới module đang tắt thì không hiện. */
export function TopicBanner({ banner, imageSizes }: { banner: HomepageBanner; imageSizes: string }) {
  const { isModuleEnabled } = useSite()
  const image = resolveMediaUrl(banner.image_path)
  const title = banner.title.trim()
  if (!title && !image) return null
  const url = banner.link_url
  const targetModule = url && !isExternalUrl(url) ? moduleOfUrl(url) : null
  if (targetModule && !isModuleEnabled(targetModule)) return null

  const light = banner.color ? !isDarkColor(banner.color) : false
  const body = title ? (
    <div
      className={`@container relative overflow-hidden rounded-xl border-b-4 border-accent ${light ? 'text-text' : 'text-white'}`}
      style={{ backgroundColor: banner.color || 'var(--brand-primary)' }}
    >
      {image && (
        <img
          src={image}
          {...responsiveImage(banner.image_path, imageSizes)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-15"
        />
      )}
      <div className="relative flex flex-col gap-4 p-5 sm:p-6 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="min-w-0 space-y-2">
          {banner.badge && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold uppercase text-black">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {banner.badge}
            </p>
          )}
          <h2 className="text-lg font-bold uppercase leading-snug sm:text-2xl sm:leading-snug">{title}</h2>
          {banner.subtitle && <p className="text-sm">{banner.subtitle}</p>}
        </div>
        {url && (
          <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-black @2xl:self-center">
            {banner.cta_label || 'Xem chi tiết'} <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </div>
  ) : (
    <img
      src={image!}
      {...responsiveImage(banner.image_path, imageSizes)}
      alt={banner.alt}
      loading="lazy"
      className="w-full rounded-xl"
    />
  )

  if (!url) return <section>{body}</section>
  return (
    <section>
      {isExternalUrl(url) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block transition hover:opacity-95">
          {body}
        </a>
      ) : (
        <Link to={url} className="block transition hover:opacity-95">
          {body}
        </Link>
      )}
    </section>
  )
}
