import { Zap } from 'lucide-react'
import { useSite } from '@/features/site/site-context'

/** Dòng tin chạy; tự dừng khi người dùng bật "giảm chuyển động" hoặc rê chuột vào. */
export function MarqueeBar() {
  const { marquee } = useSite()
  if (!marquee.enabled || marquee.items.length === 0) return null

  const text = marquee.items.join('   ★   ')
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4">
        <span className="flex shrink-0 items-center gap-1 rounded bg-accent px-2 py-1 text-xs font-bold uppercase text-white">
          <Zap className="h-3.5 w-3.5" aria-hidden /> Tin nổi bật
        </span>
        <div className="marquee relative flex-1 overflow-hidden py-2 text-sm font-medium text-primary">
          <p className="marquee-track whitespace-nowrap">
            <span>{text}</span>
            <span aria-hidden className="pl-16">
              {text}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
