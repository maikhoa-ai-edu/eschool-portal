import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { responsiveImage } from '@/features/media/api'
import { isExternalUrl } from '@/features/site/menu'
import { cn } from '@/lib/cn'
import { slideImageUrl, type Slide } from './api'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function SlideLink({ slide }: { slide: Slide }) {
  if (!slide.link_url) return null
  const className =
    'mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110'
  return isExternalUrl(slide.link_url) ? (
    <a href={slide.link_url} target="_blank" rel="noopener noreferrer" className={className}>
      Xem chi tiết
    </a>
  ) : (
    <Link to={slide.link_url} className={className}>
      Xem chi tiết
    </Link>
  )
}

/**
 * Trình chiếu ảnh đầu trang chủ. Tự chuyển sau `interval` giây; dừng khi rê chuột/đặt focus vào,
 * khi người dùng bấm tạm dừng hoặc bật chế độ giảm chuyển động của hệ điều hành.
 */
export function HeroSlider({ slides, interval }: { slides: Slide[]; interval: number }) {
  const [index, setIndex] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [paused, setPaused] = useState(prefersReducedMotion)
  const count = slides.length
  const current = index % count

  useEffect(() => {
    if (count < 2 || paused || hovering) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), interval * 1000)
    return () => window.clearTimeout(id)
  }, [count, paused, hovering, interval, current])

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)
  const control =
    'flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55'

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Ảnh nổi bật"
      className="relative mb-6 overflow-hidden rounded-2xl bg-primary shadow-sm"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="relative aspect-[16/10] sm:aspect-[16/7] lg:aspect-[21/8]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1}/${count}: ${slide.title}`}
            aria-hidden={i !== current}
            inert={i !== current}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none',
              i === current ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <img
              src={slideImageUrl(slide)}
              {...responsiveImage(slide.image_path, '(min-width: 1280px) 1248px, calc(100vw - 32px)')}
              fetchPriority={i === 0 ? 'high' : undefined}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 p-4 pb-10 text-white sm:p-8 sm:pb-12">
              <h2 className="max-w-3xl text-lg font-bold leading-snug drop-shadow sm:text-3xl">
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="mt-1 hidden max-w-2xl text-sm text-white/90 drop-shadow sm:block sm:text-base">
                  {slide.subtitle}
                </p>
              )}
              <div className="hidden sm:block">
                <SlideLink slide={slide} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={cn(control, 'absolute left-3 top-1/2 -translate-y-1/2')}
            aria-label="Ảnh trước"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={cn(control, 'absolute right-3 top-1/2 -translate-y-1/2')}
            aria-label="Ảnh sau"
            onClick={() => go(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Chuyển tới ảnh ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  i === current ? 'w-7 bg-accent' : 'w-2.5 bg-white/70 hover:bg-white',
                )}
              />
            ))}
            <button
              type="button"
              className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-white"
              aria-label={paused ? 'Tiếp tục tự chạy' : 'Tạm dừng tự chạy'}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
