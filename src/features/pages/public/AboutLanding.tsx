import type { ReactNode } from 'react'
import { Eye, Gem, History, MapPin, Target, Trees } from 'lucide-react'
import { PublicPageHeader } from '@/components/content/PublicPage'
import { RichContent } from '@/components/content/RichContent'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { useSite } from '@/features/site/site-context'
import { mapEmbedUrl, parseAboutLanding } from '../landing'

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        {icon}
      </span>
      {children}
    </h2>
  )
}

const iconClass = 'h-5 w-5'

/** Trang Giới thiệu dạng landing: ảnh tập thể và các mục có khung viền, nền nổi bật. Mục để trống tự ẩn. */
export function AboutLanding({
  page,
}: {
  page: { title: string; content: string; featured_image_url: string | null; landing: unknown }
}) {
  const { identity } = useSite()
  const landing = parseAboutLanding(page.landing)
  const hero = resolveMediaUrl(page.featured_image_url)
  const map = mapEmbedUrl(landing.map_url)
  const values = landing.core_values.filter((v) => v.title.trim())
  const images = landing.campus_images.filter((path) => resolveMediaUrl(path))
  const tagline = landing.tagline || identity.slogan

  return (
    <div className="space-y-8">
      <PublicPageHeader title={page.title} crumbs={[{ label: page.title }]} hideTitle />
      <section className="relative -mt-3 overflow-hidden rounded-2xl bg-primary text-white shadow-sm">
        {hero && (
          <img
            src={hero}
            {...responsiveImage(page.featured_image_url, '(min-width: 1280px) 1248px, calc(100vw - 32px)')}
            fetchPriority="high"
            alt={`Tập thể ${identity.school_name}`}
            className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]"
          />
        )}
        <div
          className={
            hero
              ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 sm:p-8 sm:pt-24'
              : 'p-8 sm:p-12'
          }
        >
          <p aria-hidden className="text-2xl font-bold sm:text-4xl">
            {page.title}
          </p>
          <p className="mt-1 text-sm font-medium text-white/90 sm:text-lg">
            {[identity.school_name, tagline].filter(Boolean).join(' · ')}
          </p>
        </div>
      </section>

      {page.content.trim() && (
        <section className="rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
          <RichContent html={page.content} />
        </section>
      )}

      {landing.history && (
        <section className="space-y-3 rounded-2xl border-2 border-primary/20 border-l-8 border-l-primary bg-surface p-5 shadow-sm sm:p-8">
          <SectionTitle icon={<History className={iconClass} aria-hidden />}>Lịch sử hình thành</SectionTitle>
          <p className="whitespace-pre-line leading-relaxed">{landing.history}</p>
        </section>
      )}

      {(landing.mission || landing.vision) && (
        <div className="grid gap-5 md:grid-cols-2 md:[&>:only-child]:col-span-2">
          {landing.mission && (
            <section className="space-y-3 rounded-2xl bg-primary p-5 text-white shadow-sm sm:p-8">
              <h2 className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
                <Target className="h-6 w-6" aria-hidden /> Sứ mệnh
              </h2>
              <p className="whitespace-pre-line leading-relaxed">{landing.mission}</p>
            </section>
          )}
          {landing.vision && (
            <section className="space-y-3 rounded-2xl border-2 border-primary bg-primary/10 p-5 shadow-sm sm:p-8">
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-primary sm:text-2xl">
                <Eye className="h-6 w-6" aria-hidden /> Tầm nhìn
              </h2>
              <p className="whitespace-pre-line leading-relaxed">{landing.vision}</p>
            </section>
          )}
        </div>
      )}

      {values.length > 0 && (
        <section className="space-y-4 rounded-2xl border-2 border-accent/40 bg-accent/10 p-5 sm:p-8">
          <SectionTitle icon={<Gem className={iconClass} aria-hidden />}>Giá trị cốt lõi</SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, i) => (
              <li key={i} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="font-bold text-primary">{value.title}</p>
                {value.text && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{value.text}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(landing.campus_text || images.length > 0) && (
        <section className="space-y-4 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 sm:p-8">
          <SectionTitle icon={<Trees className={iconClass} aria-hidden />}>Khuôn viên</SectionTitle>
          {landing.campus_text && (
            <p className="whitespace-pre-line leading-relaxed">{landing.campus_text}</p>
          )}
          {images.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {images.map((path, i) => (
                <li key={path} className="overflow-hidden rounded-xl border-2 border-surface shadow-sm">
                  <img
                    src={resolveMediaUrl(path)!}
                    {...responsiveImage(path, '(min-width: 1024px) 400px, 50vw')}
                    alt={`Khuôn viên trường, ảnh ${i + 1}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {map && (
        <section className="space-y-4 rounded-2xl border-2 border-primary/20 bg-surface p-5 shadow-sm sm:p-8">
          <SectionTitle icon={<MapPin className={iconClass} aria-hidden />}>Bản đồ</SectionTitle>
          {identity.address && <p>{identity.address}</p>}
          <iframe
            src={map}
            title={`Bản đồ ${identity.school_name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[4/3] w-full rounded-xl border border-border sm:aspect-[21/9]"
          />
        </section>
      )}
    </div>
  )
}
