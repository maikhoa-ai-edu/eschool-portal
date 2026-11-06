import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Feather, MessageCircle } from 'lucide-react'
import { resolveMediaUrl, responsiveImage } from '@/features/media/api'
import { topReactions } from '@/features/reactions/reactions'
import { useSite } from '@/features/site/site-context'
import { formatNumber } from '@/lib/format'
import { CONTESTS_KEY, fetchContestEntries } from './api'
import { sortEntries, type ContestSort } from './ranking'

/** Lưới bài dự thi: ảnh, tên bài, học sinh – lớp, đoạn trích, số cảm xúc. Bấm vào mở bài chi tiết. */
export function ContestGrid({
  contestId,
  sort,
  limit,
  narrow = false,
}: {
  contestId: string
  sort: ContestSort
  limit: number
  narrow?: boolean
}) {
  const { isModuleEnabled } = useSite()
  const { data = [], isPending } = useQuery({
    queryKey: [...CONTESTS_KEY, 'entries', contestId],
    queryFn: () => fetchContestEntries(contestId),
    enabled: Boolean(contestId),
  })
  if (isPending && contestId) return null
  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#c9a45c] bg-[#fdf8ec] p-6 text-center text-sm text-[#6b5a45]">
        Các bài dự thi sẽ được đăng tại đây.
      </p>
    )
  }
  const entries = sortEntries(data, sort).slice(0, limit)
  const showReactions = isModuleEnabled('reactions')

  return (
    <ul className={narrow ? 'grid gap-4' : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
      {entries.map((e) => {
        const image = resolveMediaUrl(e.thumbnail_url)
        const top = topReactions(e.reactions)
        return (
          <li key={e.id}>
            <Link
              to={`/tin-tuc/${e.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border-2 border-[#e5d3a8] bg-[#fdf8ec] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9a45c] hover:shadow-md"
            >
              {image ? (
                <img
                  src={image}
                  {...responsiveImage(
                    e.thumbnail_url,
                    '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw',
                  )}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full border-b-2 border-[#e5d3a8] object-cover"
                />
              ) : (
                <span className="flex aspect-[4/3] items-center justify-center border-b-2 border-[#e5d3a8] bg-[#f6ecd5] text-[#c9a45c]">
                  <Feather className="h-10 w-10" aria-hidden />
                </span>
              )}
              <div className="flex flex-1 flex-col gap-2 p-4 text-[#3b2f22]">
                <h3 className="line-clamp-2 font-letter text-lg font-bold leading-snug text-[#7a2331] group-hover:underline">
                  {e.title}
                </h3>
                {e.author_name && (
                  <p className="text-sm font-semibold">
                    {e.author_name}
                    {e.author_class && (
                      <span className="font-normal text-[#6b5a45]"> · Lớp {e.author_class}</span>
                    )}
                  </p>
                )}
                {e.excerpt && (
                  <p className="line-clamp-3 border-l-2 border-[#c9a45c] pl-3 font-letter text-sm italic text-[#6b5a45]">
                    “{e.excerpt}”
                  </p>
                )}
                <p className="mt-auto flex items-center gap-3 pt-2 text-xs text-[#6b5a45]">
                  {showReactions && (
                    <span className="flex items-center gap-1">
                      <span aria-hidden>{top.length > 0 ? top.map((r) => r.emoji).join('') : '👍'}</span>
                      {formatNumber(e.total_reactions)} <span className="sr-only">lượt cảm xúc</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {formatNumber(e.comment_count)}
                    <span className="sr-only">bình luận</span>
                  </span>
                </p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
