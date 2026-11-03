import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Kéo xuống quá chừng này lần chiều cao màn hình thì hiện nút */
const SHOW_AFTER_SCREENS = 1.5

/**
 * Nút lên đầu trang ở góc phải dưới. `aboveBottomBar`: trên điện thoại nút nằm trên thanh menu đáy để không che menu.
 */
export function BackToTop({ aboveBottomBar = false }: { aboveBottomBar?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setVisible(window.scrollY > window.innerHeight * SHOW_AFTER_SCREENS)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  if (!visible) return null
  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      className={cn(
        'fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-2 ring-white/70 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden',
        'mr-[env(safe-area-inset-right)] bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        aboveBottomBar && 'max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}
