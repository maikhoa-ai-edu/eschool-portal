import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, SendHorizontal, ThumbsUp, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { confirmAction } from '@/components/admin/confirm'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime, formatNumber, formatRelativeTime } from '@/lib/format'
import {
  addComment,
  COMMENT_MAX_LENGTH,
  COMMENTS_KEY,
  deleteComment,
  fetchCommentLikeCounts,
  fetchMyCommentLikes,
  fetchNewsComments,
  setCommentLike,
} from './api'
import { avatarColor, initials, threadComments } from './thread'

type Comment = Awaited<ReturnType<typeof fetchNewsComments>>[number]

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        small ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs',
      )}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  )
}

/** Ô viết bình luận dạng bong bóng tròn như Facebook. */
function Composer({
  name,
  label,
  submitLabel,
  placeholder,
  small = false,
  autoFocus = false,
  onSend,
  pending,
}: {
  name: string
  label: string
  submitLabel: string
  placeholder: string
  small?: boolean
  autoFocus?: boolean
  onSend: (text: string) => Promise<unknown>
  pending: boolean
}) {
  const [text, setText] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) void onSend(text.trim()).then(() => setText(''))
  }
  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <Avatar name={name} small={small} />
      <div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl bg-bg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
        <textarea
          aria-label={label}
          value={text}
          rows={1}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          className="max-h-40 min-h-7 flex-1 resize-y bg-transparent py-1 text-sm outline-none [field-sizing:content]"
        />
        <button
          type="submit"
          aria-label={submitLabel}
          disabled={!text.trim() || pending}
          className="mb-0.5 rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:text-muted disabled:hover:bg-transparent"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </form>
  )
}

/**
 * Bình luận kiểu Facebook: bong bóng, thích và trả lời một cấp. Nội dung hiện dạng chữ thuần;
 * bình luận và trả lời mới đều chờ duyệt mới công khai.
 */
export function NewsComments({ newsId }: { newsId: string }) {
  const { status, profile } = useAuth()
  const { authOptions, isModuleEnabled } = useSite()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [sent, setSent] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const enabled = isModuleEnabled('comments')
  const signedIn = status === 'signed_in' && Boolean(profile?.is_active)
  const viewer = profile?.id ?? 'guest'
  const { data = [], isPending } = useQuery({
    queryKey: [...COMMENTS_KEY, newsId, viewer],
    queryFn: () => fetchNewsComments(newsId),
    enabled,
  })
  const { data: likeCounts = new Map<string, number>() } = useQuery({
    queryKey: [...COMMENTS_KEY, newsId, 'likes'],
    queryFn: () => fetchCommentLikeCounts(newsId),
    enabled: enabled && data.length > 0,
  })
  const approvedIds = data.filter((c) => c.status === 'approved').map((c) => c.id)
  const { data: myLikes = new Set<string>() } = useQuery({
    queryKey: [...COMMENTS_KEY, newsId, 'my-likes', viewer, approvedIds.join()],
    queryFn: () => fetchMyCommentLikes(approvedIds),
    enabled: enabled && signedIn && approvedIds.length > 0,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMMENTS_KEY })
  const add = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: string | null }) =>
      addComment(newsId, text, parentId),
    onSuccess: async () => {
      setSent(true)
      setReplyTo(null)
      await invalidate()
    },
  })
  const remove = useMutation({ mutationFn: deleteComment, onSuccess: invalidate })
  const like = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) => setCommentLike(id, liked),
    onSettled: invalidate,
  })

  if (!enabled || isPending || status === 'loading') return null
  const canJoin = authOptions.allow_self_signup || authOptions.google_enabled
  // Trường không mở tài khoản cho khách và bài chưa có bình luận thì không hiện khung trống
  if (!signedIn && data.length === 0 && !canJoin) return null

  const next = encodeURIComponent(location.pathname)
  const threads = threadComments(data)
  const approvedCount = approvedIds.length
  const myName = profile?.full_name ?? ''
  const send = (text: string, parentId: string | null) => {
    setSent(false)
    return add.mutateAsync({ text, parentId })
  }

  const renderComment = (c: Comment, isReply: boolean) => {
    const likes = likeCounts.get(c.id) ?? 0
    const liked = myLikes.has(c.id)
    const approved = c.status === 'approved'
    return (
      <div className="flex items-start gap-2">
        <Avatar name={c.author_name} small={isReply} />
        <div className="min-w-0 flex-1">
          <div className="relative inline-block max-w-full rounded-2xl bg-bg px-3 py-2">
            <p className="text-sm font-semibold">{c.author_name}</p>
            <p className="whitespace-pre-line break-words text-sm">{c.content}</p>
            {likes > 0 && (
              <span className="absolute -bottom-2.5 right-1 flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[11px] shadow">
                <ThumbsUp className="h-3 w-3 fill-primary text-primary" aria-hidden />
                {formatNumber(likes)}
                <span className="sr-only">lượt thích</span>
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs text-muted">
            {approved &&
              (signedIn ? (
                <button
                  type="button"
                  aria-pressed={liked}
                  aria-label={`Thích bình luận của ${c.author_name}`}
                  onClick={() => like.mutate({ id: c.id, liked: !liked })}
                  className={cn('font-semibold hover:underline', liked && 'text-primary')}
                >
                  Thích
                </button>
              ) : (
                <Link to={`/dang-nhap?next=${next}`} className="font-semibold hover:underline">
                  Thích
                </Link>
              ))}
            {approved &&
              !isReply &&
              (signedIn ? (
                <button
                  type="button"
                  aria-label={`Trả lời ${c.author_name}`}
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  className="font-semibold hover:underline"
                >
                  Trả lời
                </button>
              ) : (
                <Link to={`/dang-nhap?next=${next}`} className="font-semibold hover:underline">
                  Trả lời
                </Link>
              ))}
            <time dateTime={c.created_at} title={formatDateTime(c.created_at)}>
              {formatRelativeTime(c.created_at)}
            </time>
            {c.status === 'pending' && <Badge tone="warning">Chờ duyệt</Badge>}
            {c.status === 'hidden' && <Badge>Đã ẩn</Badge>}
            {c.user_id === profile?.id && (
              <button
                type="button"
                aria-label="Xóa bình luận của tôi"
                className="text-danger"
                onClick={() => {
                  if (confirmAction('Xóa bình luận này?')) remove.mutate(c.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="binh-luan" className="mt-6 rounded-xl bg-surface p-4 shadow-sm sm:p-6">
      <h2
        id="binh-luan"
        className="mb-4 flex items-center gap-2 border-b-2 border-accent pb-2 text-lg font-bold uppercase text-primary"
      >
        <MessageSquare className="h-5 w-5" aria-hidden /> Bình luận
        {approvedCount > 0 && (
          <span className="text-sm font-semibold text-muted">({formatNumber(approvedCount)})</span>
        )}
      </h2>

      {sent && <Alert tone="success" title="Đã gửi. Bình luận sẽ hiện sau khi được duyệt." />}
      {(add.error ?? like.error) && (
        <Alert tone="danger" title={toVietnameseError(add.error ?? like.error)} />
      )}

      <div className="mt-3">
        {signedIn ? (
          <Composer
            name={myName}
            label="Viết bình luận"
            submitLabel="Gửi bình luận"
            placeholder="Viết bình luận..."
            pending={add.isPending}
            onSend={(text) => send(text, null)}
          />
        ) : (
          <Link to={`/dang-nhap?next=${next}`} className={buttonClasses('outline')}>
            Đăng nhập để bình luận
          </Link>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Chưa có bình luận. Hãy là người đầu tiên chia sẻ cảm nghĩ.</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              {renderComment(comment, false)}
              {(replies.length > 0 || replyTo === comment.id) && (
                <ul className="ml-11 mt-3 space-y-3 border-l-2 border-border pl-3">
                  {replies.map((r) => (
                    <li key={r.id}>{renderComment(r, true)}</li>
                  ))}
                  {replyTo === comment.id && (
                    <li>
                      <Composer
                        name={myName}
                        small
                        autoFocus
                        label={`Trả lời ${comment.author_name}`}
                        submitLabel="Gửi trả lời"
                        placeholder={`Trả lời ${comment.author_name}...`}
                        pending={add.isPending}
                        onSend={(text) => send(text, comment.id)}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
