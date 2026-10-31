import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-classes'
import { confirmAction } from '@/components/admin/confirm'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { addComment, COMMENT_MAX_LENGTH, COMMENTS_KEY, deleteComment, fetchNewsComments } from './api'

/** Luồng bình luận dưới bài: nội dung hiện dạng chữ thuần, bình luận mới chờ duyệt mới công khai. */
export function NewsComments({ newsId }: { newsId: string }) {
  const { status, profile } = useAuth()
  const { authOptions, isModuleEnabled } = useSite()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const enabled = isModuleEnabled('comments')
  const signedIn = status === 'signed_in' && profile?.is_active
  const key = [...COMMENTS_KEY, newsId, profile?.id ?? 'guest']
  const { data = [], isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchNewsComments(newsId),
    enabled,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMMENTS_KEY })
  const add = useMutation({
    mutationFn: () => addComment(newsId, text.trim()),
    onSuccess: async () => {
      setText('')
      setSent(true)
      await invalidate()
    },
  })
  const remove = useMutation({ mutationFn: deleteComment, onSuccess: invalidate })

  if (!enabled || isPending || status === 'loading') return null
  const canJoin = authOptions.allow_self_signup || authOptions.google_enabled
  // Trường không mở tài khoản cho khách và bài chưa có bình luận thì không hiện khung trống
  if (!signedIn && data.length === 0 && !canJoin) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSent(false)
    if (text.trim()) add.mutate()
  }
  const next = encodeURIComponent(location.pathname)

  return (
    <section aria-labelledby="binh-luan" className="mt-6 rounded-xl bg-surface p-4 shadow-sm sm:p-6">
      <h2
        id="binh-luan"
        className="mb-4 flex items-center gap-2 border-b-2 border-accent pb-2 text-lg font-bold uppercase text-primary"
      >
        <MessageSquare className="h-5 w-5" aria-hidden /> Bình luận
      </h2>
      {data.length === 0 ? (
        <p className="mb-4 text-sm text-muted">Chưa có bình luận.</p>
      ) : (
        <ul className="mb-5 space-y-4">
          {data.map((c) => (
            <li key={c.id} className="border-b border-border pb-3 last:border-0">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{c.author_name}</strong>
                <span className="text-xs text-muted">{formatDateTime(c.created_at)}</span>
                {c.status === 'pending' && <Badge tone="warning">Chờ duyệt</Badge>}
                {c.status === 'hidden' && <Badge>Đã ẩn</Badge>}
                {c.user_id === profile?.id && (
                  <button
                    type="button"
                    aria-label="Xóa bình luận của tôi"
                    className="ml-auto text-danger"
                    onClick={() => {
                      if (confirmAction('Xóa bình luận này?')) remove.mutate(c.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-sm">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      {signedIn ? (
        <form onSubmit={submit} className="space-y-2">
          {sent && <Alert tone="success" title="Đã gửi bình luận. Bình luận sẽ hiện sau khi được duyệt." />}
          {add.error && <Alert tone="danger" title={toVietnameseError(add.error)} />}
          <label htmlFor="noi-dung-binh-luan" className="block text-sm font-medium">
            Viết bình luận
          </label>
          <textarea
            id="noi-dung-binh-luan"
            value={text}
            rows={3}
            maxLength={COMMENT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm"
          />
          <Button type="submit" loading={add.isPending} disabled={!text.trim()}>
            Gửi bình luận
          </Button>
        </form>
      ) : (
        <Link to={`/dang-nhap?next=${next}`} className={buttonClasses('outline')}>
          Đăng nhập để bình luận
        </Link>
      )}
    </section>
  )
}
