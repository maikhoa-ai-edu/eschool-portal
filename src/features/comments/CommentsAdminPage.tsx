import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, EyeOff, Trash2 } from 'lucide-react'
import { AdminPageHeader, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import {
  COMMENT_PAGE_SIZE,
  COMMENT_STATUS_LABELS,
  COMMENTS_KEY,
  deleteComment,
  fetchAdminComments,
  setCommentStatus,
  type CommentStatus,
} from './api'

const STATUSES: CommentStatus[] = ['pending', 'approved', 'hidden']

export function CommentsAdminPage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params)
  const status = STATUSES.find((s) => s === params.get('trang-thai')) ?? 'pending'
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...COMMENTS_KEY, 'admin', status, page],
    queryFn: () => fetchAdminComments(status, page),
  })
  const action = useMutation({
    mutationFn: (task: () => Promise<void>) => task(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMMENTS_KEY }),
  })

  return (
    <div>
      <AdminPageHeader
        title="Bình luận"
        description="Bình luận của người đăng nhập chỉ hiện công khai sau khi được duyệt."
      />
      <div role="tablist" aria-label="Lọc bình luận" className="mb-4 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === status}
            onClick={() => setParams({ 'trang-thai': s })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              s === status ? 'bg-primary text-white' : 'bg-surface hover:bg-bg',
            )}
          >
            {COMMENT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {action.error && <Alert tone="danger" title={toVietnameseError(action.error)} />}
      <QueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && <EmptyState title="Không có bình luận nào" />}
      {data && data.items.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {data.items.map((c) => (
              <li key={c.id} className="p-4">
                <p className="text-sm">
                  <strong>{c.author_name}</strong>{' '}
                  <span className="text-xs text-muted">{formatDateTime(c.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-sm">{c.content}</p>
                {c.news && (
                  <Link
                    to={`/tin-tuc/${c.news.slug}`}
                    target="_blank"
                    className="mt-1 block text-xs text-primary hover:underline"
                  >
                    Bài: {c.news.title}
                  </Link>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.status !== 'approved' && (
                    <Button
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate(() => setCommentStatus(c.id, 'approved'))}
                    >
                      <Check className="h-4 w-4" aria-hidden /> Duyệt
                    </Button>
                  )}
                  {c.status !== 'hidden' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate(() => setCommentStatus(c.id, 'hidden'))}
                    >
                      <EyeOff className="h-4 w-4" aria-hidden /> Ẩn
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => {
                      if (confirmAction('Xóa hẳn bình luận này?')) action.mutate(() => deleteComment(c.id))
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(data.total / COMMENT_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
}
