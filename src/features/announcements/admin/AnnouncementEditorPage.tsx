import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { ExternalLink, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { RichEditor } from '@/components/editor/RichEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import {
  ANNOUNCEMENTS_KEY,
  asPriority,
  deleteAnnouncement,
  fetchAnnouncement,
  isPast,
  PRIORITIES,
  PRIORITY_LABELS,
  saveAnnouncement,
  type EditableAnnouncement,
} from '../api'
import { AnnouncementStatusBadge } from './AnnouncementListPage'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(300, 'Tiêu đề quá dài'),
  content: z.string(),
  priority: z.enum(PRIORITIES),
  is_pinned: z.boolean(),
  expires_at: z.string(),
})
type Values = z.infer<typeof schema>
type Action = 'draft' | 'publish' | 'save' | 'unpublish'

function AnnouncementForm({ announcement }: { announcement: EditableAnnouncement | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Action | 'delete' | null>(null)
  const published = announcement?.status === 'published'

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: announcement?.title ?? '',
      content: announcement?.content ?? '',
      priority: asPriority(announcement?.priority ?? 'normal'),
      is_pinned: announcement?.is_pinned ?? false,
      expires_at: toDateTimeLocal(announcement?.expires_at),
    },
  })
  const e = form.formState.errors

  const run = async (action: Action, values: Values) => {
    setError(null)
    setMessage(null)
    const expiresAt = fromDateTimeLocal(values.expires_at)
    const status = action === 'publish' || (action === 'save' && published) ? 'published' : 'draft'
    if (status === 'published' && expiresAt && isPast(expiresAt)) {
      form.setError('expires_at', { message: 'Thời điểm hết hạn phải ở tương lai' })
      return
    }
    setBusy(action)
    try {
      const id = await saveAnnouncement(
        {
          title: values.title,
          content: values.content,
          priority: values.priority,
          is_pinned: values.is_pinned,
          status,
          expires_at: expiresAt,
        },
        announcement?.id,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      ])
      const done =
        action === 'publish'
          ? 'Đã đăng thông báo.'
          : action === 'unpublish'
            ? 'Đã chuyển về nháp.'
            : 'Đã lưu.'
      if (!announcement) navigate(`/admin/thong-bao/${id}`, { replace: true, state: { message: done } })
      else setMessage(done)
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!announcement || !confirmAction(`Xóa thông báo "${announcement.title}"?`)) return
    setBusy('delete')
    try {
      await deleteAnnouncement(announcement.id)
      await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY })
      navigate('/admin/thong-bao', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setBusy(null)
    }
  }

  const actions: Array<{ action: Action; label: string; variant: 'primary' | 'outline' | 'danger' }> =
    published
      ? [
          { action: 'save', label: 'Lưu thay đổi', variant: 'primary' },
          { action: 'unpublish', label: 'Chuyển về nháp', variant: 'outline' },
        ]
      : [
          { action: 'draft', label: 'Lưu nháp', variant: 'outline' },
          { action: 'publish', label: 'Đăng thông báo', variant: 'primary' },
        ]

  return (
    <div>
      <AdminPageHeader
        title={announcement ? 'Sửa thông báo' : 'Thêm thông báo'}
        backTo="/admin/thong-bao"
        actions={
          announcement && (
            <Link
              to={`/thong-bao/${announcement.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {published ? 'Xem trên trang' : 'Xem trước'}{' '}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )
        }
      />
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-5 xl:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          {message && <Alert tone="success" title={message} />}
          {error && <Alert tone="danger" title={error} />}
          <Panel>
            <Field label="Tiêu đề" error={e.title?.message} {...form.register('title')} />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Nội dung</p>
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <RichEditor
                    label="Nội dung thông báo"
                    initialValue={field.value}
                    onChange={field.onChange}
                    uploadFolder="announcements"
                  />
                )}
              />
            </div>
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Đăng thông báo">
            {announcement && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Trạng thái</span>
                <AnnouncementStatusBadge item={announcement} />
              </div>
            )}
            {announcement?.published_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Ngày đăng</span>
                <span>{formatDateTime(announcement.published_at)}</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  variant={a.variant}
                  loading={busy === a.action}
                  disabled={busy !== null}
                  onClick={() => void form.handleSubmit((values) => run(a.action, values))()}
                >
                  {a.label}
                </Button>
              ))}
              {announcement && (
                <Button
                  variant="ghost"
                  loading={busy === 'delete'}
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa thông báo
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Hiển thị">
            <SelectField
              label="Mức độ"
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              {...form.register('priority')}
            />
            <CheckboxField label="Ghim lên đầu" {...form.register('is_pinned')} />
            <Field
              label="Hết hạn lúc"
              type="datetime-local"
              hint="Để trống nếu thông báo không có hạn. Quá hạn sẽ tự ẩn khỏi trang công khai."
              error={e.expires_at?.message}
              {...form.register('expires_at')}
            />
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export function AnnouncementEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, 'edit', id],
    queryFn: () => fetchAnnouncement(id!),
    enabled: Boolean(id),
  })
  if (id && (query.isPending || query.error))
    return <QueryState isPending={query.isPending} error={query.error} />
  if (id && !query.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy thông báo" backTo="/admin/thong-bao" />
        <Alert tone="warning" title="Thông báo không tồn tại hoặc đã bị xóa." />
      </div>
    )
  }
  return <AnnouncementForm key={id ?? 'new'} announcement={query.data ?? null} />
}
