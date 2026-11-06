import { Link, useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime, formatNumber } from '@/lib/format'
import { fetchMyReaction, fetchReactionCounts, REACTIONS_KEY, setMyReaction } from './api'
import {
  applyMyReaction,
  isVotingClosed,
  REACTIONS,
  topReactions,
  totalReactions,
  type ReactionKey,
} from './reactions'

/**
 * Dải cảm xúc dưới bài: khách xem được số đếm, chỉ tài khoản đăng nhập mới bấm được (mỗi người một lượt).
 * `votingEndsAt` là hạn bình chọn của cuộc thi chứa bài này, nếu có.
 */
export function ReactionBar({ newsId, votingEndsAt }: { newsId: string; votingEndsAt?: string | null }) {
  const { status, profile } = useAuth()
  const { isModuleEnabled } = useSite()
  const location = useLocation()
  const queryClient = useQueryClient()
  const enabled = isModuleEnabled('reactions')
  const signedIn = status === 'signed_in' && Boolean(profile?.is_active)
  const closed = isVotingClosed(votingEndsAt)

  const countsKey = [...REACTIONS_KEY, 'counts', newsId]
  const mineKey = [...REACTIONS_KEY, 'mine', newsId, profile?.id ?? 'guest']
  const { data: counts = {} } = useQuery({
    queryKey: countsKey,
    queryFn: async () => (await fetchReactionCounts([newsId])).get(newsId) ?? {},
    enabled,
  })
  const { data: mine = null } = useQuery({
    queryKey: mineKey,
    queryFn: () => fetchMyReaction(newsId),
    enabled: enabled && signedIn,
  })
  const change = useMutation({
    mutationFn: (next: ReactionKey | null) => setMyReaction(newsId, next),
    onMutate: (next) => {
      queryClient.setQueryData(countsKey, applyMyReaction(counts, mine, next))
      queryClient.setQueryData(mineKey, next)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: REACTIONS_KEY }),
  })

  if (!enabled) return null
  const total = totalReactions(counts)
  const top = topReactions(counts)
  const next = encodeURIComponent(location.pathname)

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-1.5" aria-live="polite">
          {top.length > 0 && (
            <span aria-hidden className="flex -space-x-1">
              {top.map((r) => (
                <span
                  key={r.key}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm ring-2 ring-surface"
                >
                  {r.emoji}
                </span>
              ))}
            </span>
          )}
          <span className="text-muted">
            {total > 0 ? `${formatNumber(total)} lượt bày tỏ cảm xúc` : 'Chưa có lượt bày tỏ cảm xúc'}
          </span>
        </p>
        {votingEndsAt && (
          <p className={cn('text-xs', closed ? 'font-semibold text-danger' : 'text-muted')}>
            {closed ? 'Đã hết hạn bình chọn' : `Hạn bình chọn: ${formatDateTime(votingEndsAt)}`}
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Bày tỏ cảm xúc">
        {REACTIONS.map((r) => {
          const selected = mine === r.key
          const count = counts[r.key] ?? 0
          const body = (
            <>
              <span aria-hidden className="text-lg leading-none">
                {r.emoji}
              </span>
              {r.label}
              {count > 0 && <span className="text-xs text-muted">{formatNumber(count)}</span>}
            </>
          )
          const classes = cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
            selected
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary hover:text-primary',
            closed && 'cursor-not-allowed opacity-60 hover:border-border hover:text-inherit',
          )
          return (
            <li key={r.key}>
              {signedIn || closed ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={closed || change.isPending}
                  onClick={() => change.mutate(selected ? null : r.key)}
                  className={classes}
                >
                  {body}
                </button>
              ) : (
                <Link to={`/dang-nhap?next=${next}`} className={classes} title="Đăng nhập để bày tỏ cảm xúc">
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      {!signedIn && !closed && (
        <p className="text-xs text-muted">
          <Link to={`/dang-nhap?next=${next}`} className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>{' '}
          để bày tỏ cảm xúc. Mỗi tài khoản được tính một lượt cho mỗi bài.
        </p>
      )}
      {change.error && (
        <p role="alert" className="text-sm text-danger">
          {toVietnameseError(change.error)}
        </p>
      )}
    </div>
  )
}
