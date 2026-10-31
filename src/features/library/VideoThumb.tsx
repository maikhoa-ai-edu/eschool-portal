import { PlayCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { videoThumbnail } from './api'

export function VideoThumb({ url }: { url: string }) {
  const thumb = videoThumbnail(url)
  return (
    <span className="relative block aspect-video overflow-hidden rounded-xl bg-primary/10">
      {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
        <PlayCircle className={cn('h-12 w-12', !thumb && 'text-primary')} aria-hidden />
      </span>
    </span>
  )
}
