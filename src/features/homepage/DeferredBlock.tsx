import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Khối cách màn hình trong khoảng này thì dựng trước, để người dùng cuộn tới là đã có nội dung. */
const NEAR_VIEWPORT = '300px'
/** Sau chừng này khối nào chưa dựng cũng dựng, để tìm trong trang (Ctrl+F) và bot đọc đủ nội dung. */
const REVEAL_AFTER_MS = 3000

/**
 * Hoãn dựng khối (và các truy vấn của khối) tới khi gần vào màn hình, để slide đầu trang tải trước.
 * Khi đã dựng thì không còn thẻ bọc, nên bố cục giống hệt khối không hoãn.
 */
export function DeferredBlock({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(() => typeof IntersectionObserver === 'undefined')
  const placeholder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (revealed || !placeholder.current) return
    const reveal = () => setRevealed(true)
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && reveal(),
      {
        rootMargin: NEAR_VIEWPORT,
      },
    )
    observer.observe(placeholder.current)
    const timer = window.setTimeout(reveal, REVEAL_AFTER_MS)
    // Người dùng bàn phím: phím Tab không được nhảy qua các khối chưa dựng
    window.addEventListener('keydown', reveal, { once: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      window.removeEventListener('keydown', reveal)
    }
  }, [revealed])

  if (revealed) return <>{children}</>
  return <div ref={placeholder} data-deferred-block className="min-h-64" aria-hidden />
}
