import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState, TableCard } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { REACTIONS, isVotingClosed } from '@/features/reactions/reactions'
import { toVietnameseError } from '@/lib/errors'
import { formatDate, formatDateTime, formatNumber, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import {
  CONTESTS_KEY,
  deleteContest,
  fetchContestEntries,
  fetchContests,
  saveContest,
  type ContestRow,
} from './api'
import { rankEntries, rankingCsv } from './ranking'

function ContestForm({ contest, onDone }: { contest: ContestRow | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(contest?.title ?? '')
  const [tagName, setTagName] = useState(contest?.tag?.name ?? '')
  const [endsAt, setEndsAt] = useState(toDateTimeLocal(contest?.vote_ends_at))
  const save = useMutation({
    mutationFn: () =>
      saveContest({ title, tag_name: tagName, vote_ends_at: fromDateTimeLocal(endsAt) }, contest?.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CONTESTS_KEY })
      onDone()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (title.trim() && tagName.trim()) save.mutate()
  }
  return (
    <Panel title={contest ? 'Sửa cuộc thi' : 'Thêm cuộc thi'}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {save.error && <Alert tone="danger" title={toVietnameseError(save.error)} />}
        <Field
          label="Tên cuộc thi"
          value={title}
          maxLength={200}
          required
          onChange={(e) => setTitle(e.target.value)}
        />
        <Field
          label="Thẻ của bài dự thi"
          hint="Khi soạn bài dự thi ở mục Tin tức, gắn đúng thẻ này. Chưa có thẻ thì hệ thống tự tạo."
          placeholder="vd: Kỷ niệm thầy cô 2026"
          value={tagName}
          maxLength={80}
          required
          onChange={(e) => setTagName(e.target.value)}
        />
        <Field
          label="Hạn bình chọn"
          type="datetime-local"
          hint="Giờ Việt Nam. Sau thời điểm này không ai bấm, đổi hay bỏ cảm xúc được nữa; để trống là không giới hạn."
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending} disabled={!title.trim() || !tagName.trim()}>
            Lưu cuộc thi
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Hủy
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function Ranking({ contest }: { contest: ContestRow }) {
  const { data, isPending, error } = useQuery({
    queryKey: [...CONTESTS_KEY, 'entries', contest.id],
    queryFn: () => fetchContestEntries(contest.id),
  })
  const download = () => {
    if (!data) return
    const blob = new Blob([rankingCsv(data, window.location.origin)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `xep-hang-${contest.tag?.slug ?? 'cuoc-thi'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const ranked = data ? rankEntries(data) : []
  return (
    <Panel title={`Bảng xếp hạng: ${contest.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Xếp theo tổng cảm xúc của tài khoản đã đăng nhập (mỗi tài khoản một lượt cho mỗi bài). Lượt chia sẻ
          không được tính.
        </p>
        <Button variant="outline" size="sm" disabled={!data || data.length === 0} onClick={download}>
          <Download className="h-4 w-4" aria-hidden /> Tải file Excel (CSV)
        </Button>
      </div>
      <QueryState isPending={isPending} error={error} />
      {data &&
        (data.length === 0 ? (
          <p className="text-sm text-muted">
            Chưa có bài dự thi nào được đăng. Bài cần được duyệt và gắn thẻ “{contest.tag?.name}”.
          </p>
        ) : (
          <TableCard>
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Bài dự thi</th>
                {REACTIONS.map((r) => (
                  // Không dùng sr-only trong bảng cuộn ngang (xem Ghi chú kỹ thuật)
                  <th key={r.key} title={r.label} aria-label={r.label}>
                    {r.emoji}
                  </th>
                ))}
                <th>Tổng</th>
                <th>Bình luận</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold">{e.rank}</td>
                  <td>
                    <Link
                      to={`/tin-tuc/${e.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                    >
                      {e.title} <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                    <p className="text-xs text-muted">
                      {[e.author_name, e.author_class && `Lớp ${e.author_class}`].filter(Boolean).join(' · ')}{' '}
                      · Đăng {formatDate(e.published_at)}
                    </p>
                  </td>
                  {REACTIONS.map((r) => (
                    <td key={r.key}>{formatNumber(e.reactions[r.key] ?? 0)}</td>
                  ))}
                  <td className="font-bold">{formatNumber(e.total_reactions)}</td>
                  <td>{formatNumber(e.comment_count)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        ))}
    </Panel>
  )
}

export function ContestsAdminPage() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...CONTESTS_KEY, 'admin'],
    queryFn: fetchContests,
  })
  const [editing, setEditing] = useState<ContestRow | 'new' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: deleteContest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTESTS_KEY }),
  })
  const selected = data?.find((c) => c.id === selectedId) ?? data?.[0] ?? null

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Cuộc thi"
        description="Bài dự thi là bài viết ở mục Tin tức có gắn thẻ của cuộc thi. Hiện bài lên trang bằng khối “Bài dự thi” trong Chuyên đề."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm cuộc thi
          </Button>
        }
      />
      {remove.error && <Alert tone="danger" title={toVietnameseError(remove.error)} />}
      {editing && (
        <ContestForm
          key={editing === 'new' ? 'new' : editing.id}
          contest={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      <QueryState isPending={isPending} error={error} />
      {data &&
        (data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Chưa có cuộc thi nào.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {data.map((c) => {
              const closed = isVotingClosed(c.vote_ends_at)
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-pressed={selected?.id === c.id}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-semibold hover:text-primary">{c.title}</span>
                    <span className="block truncate text-xs text-muted">
                      Thẻ: {c.tag?.name} ·{' '}
                      {c.vote_ends_at
                        ? `Hạn bình chọn ${formatDateTime(c.vote_ends_at)}`
                        : 'Không giới hạn thời gian'}
                    </span>
                  </button>
                  <Badge tone={closed ? 'neutral' : 'success'}>
                    {closed ? 'Đã khóa bình chọn' : 'Đang bình chọn'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Sửa ${c.title}`}
                    onClick={() => setEditing(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Xóa ${c.title}`}
                    onClick={() => {
                      if (
                        confirmAction(`Xóa cuộc thi "${c.title}"? Bài viết và lượt cảm xúc vẫn giữ nguyên.`)
                      )
                        remove.mutate(c.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </li>
              )
            })}
          </ul>
        ))}
      {selected && <Ranking key={selected.id} contest={selected} />}
    </div>
  )
}
