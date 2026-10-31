import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField, TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import {
  deleteResource,
  deleteVideo,
  fetchResources,
  fetchVideos,
  isValidVideoUrl,
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
  RESOURCES_KEY,
  resourceKindLabel,
  saveResource,
  saveVideo,
  VIDEOS_KEY,
  type Resource,
  type ResourceKind,
  type Video,
} from '../api'

function nextOrder(items: Array<{ sort_order: number }>): number {
  return items.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1
}

/** Khung chung: danh sách bên trái, biểu mẫu thêm/sửa bên phải. */
function Layout({
  title,
  description,
  list,
  form,
}: {
  title: string
  description: string
  list: React.ReactNode
  form: React.ReactNode
}) {
  return (
    <div>
      <AdminPageHeader title={title} description={description} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <Panel>{list}</Panel>
        <Panel>{form}</Panel>
      </div>
    </div>
  )
}

function Row({
  title,
  meta,
  active,
  onEdit,
  onDelete,
}: {
  title: string
  meta: string
  active: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {title} {!active && <Badge>Đang ẩn</Badge>}
        </p>
        <p className="truncate text-xs text-muted">{meta}</p>
      </div>
      <Button variant="ghost" size="sm" aria-label={`Sửa "${title}"`} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Xóa "${title}"`} onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>
    </li>
  )
}

export function VideoAdminPage() {
  const queryClient = useQueryClient()
  const {
    data = [],
    isPending,
    error,
  } = useQuery({
    queryKey: [...VIDEOS_KEY, 'admin'],
    queryFn: () => fetchVideos(false),
  })
  const [editing, setEditing] = useState<Video | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setEditing(null)
    setTitle('')
    setUrl('')
    setDescription('')
    setActive(true)
  }
  const act = async (task: () => Promise<void>) => {
    setMessage(null)
    setBusy(true)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: VIDEOS_KEY })
      reset()
    } catch (err) {
      setMessage(toVietnameseError(err))
    } finally {
      setBusy(false)
    }
  }
  const badUrl = url.trim() !== '' && !isValidVideoUrl(url.trim())
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !url.trim() || badUrl) return
    void act(() =>
      saveVideo(
        { title: title.trim(), url: url.trim(), description: description.trim(), is_active: active },
        editing?.id ?? null,
        nextOrder(data),
      ),
    )
  }
  return (
    <Layout
      title="Video"
      description="Video nhúng từ YouTube hoặc Google Drive, hiện ở tab Video của khối Thư viện và trang /video."
      list={
        <>
          <QueryState isPending={isPending} error={error} />
          {message && <Alert tone="danger" title={message} />}
          {data.length === 0 && !isPending ? (
            <p className="text-sm text-muted">Chưa có video nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((v) => (
                <Row
                  key={v.id}
                  title={v.title}
                  meta={v.url}
                  active={v.is_active}
                  onEdit={() => {
                    setEditing(v)
                    setTitle(v.title)
                    setUrl(v.url)
                    setDescription(v.description ?? '')
                    setActive(v.is_active)
                  }}
                  onDelete={() => {
                    if (confirmAction(`Xóa video "${v.title}"?`)) void act(() => deleteVideo(v.id))
                  }}
                />
              ))}
            </ul>
          )}
        </>
      }
      form={
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-semibold">{editing ? 'Sửa video' : 'Thêm video'}</h2>
          <Field label="Tên video" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
          <Field
            label="Link video"
            placeholder="https://www.youtube.com/watch?v=... hoặc https://drive.google.com/file/d/..."
            value={url}
            error={badUrl ? 'Chỉ nhận link video YouTube hoặc Google Drive.' : undefined}
            hint="Video trên Drive phải bật chia sẻ cho mọi người có liên kết."
            onChange={(e) => setUrl(e.target.value)}
          />
          <TextareaField
            label="Mô tả"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
          <CheckboxField label="Hiển thị" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={!title.trim() || !url.trim() || badUrl}>
              {editing ? 'Lưu video' : 'Thêm video'}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={reset}>
                Hủy
              </Button>
            )}
          </div>
        </form>
      }
    />
  )
}

const LINK_OK = /^https?:\/\/\S+$/

export function ResourceAdminPage() {
  const queryClient = useQueryClient()
  const {
    data = [],
    isPending,
    error,
  } = useQuery({
    queryKey: [...RESOURCES_KEY, 'admin'],
    queryFn: () => fetchResources(false),
  })
  const [editing, setEditing] = useState<Resource | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<ResourceKind>('phan_mem')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setEditing(null)
    setTitle('')
    setUrl('')
    setKind('phan_mem')
    setDescription('')
    setActive(true)
  }
  const act = async (task: () => Promise<void>) => {
    setMessage(null)
    setBusy(true)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: RESOURCES_KEY })
      reset()
    } catch (err) {
      setMessage(toVietnameseError(err))
    } finally {
      setBusy(false)
    }
  }
  const badUrl = url.trim() !== '' && !LINK_OK.test(url.trim())
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !url.trim() || badUrl) return
    void act(() =>
      saveResource(
        { title: title.trim(), url: url.trim(), kind, description: description.trim(), is_active: active },
        editing?.id ?? null,
        nextOrder(data),
      ),
    )
  }
  return (
    <Layout
      title="Tài nguyên"
      description="Link phần mềm, giáo án, biểu mẫu, hiện ở tab Tài nguyên của khối Thư viện và trang /tai-nguyen."
      list={
        <>
          <QueryState isPending={isPending} error={error} />
          {message && <Alert tone="danger" title={message} />}
          {data.length === 0 && !isPending ? (
            <p className="text-sm text-muted">Chưa có tài nguyên nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((r) => (
                <Row
                  key={r.id}
                  title={r.title}
                  meta={`${resourceKindLabel(r.kind)} · ${r.url}`}
                  active={r.is_active}
                  onEdit={() => {
                    setEditing(r)
                    setTitle(r.title)
                    setUrl(r.url)
                    setKind(r.kind as ResourceKind)
                    setDescription(r.description ?? '')
                    setActive(r.is_active)
                  }}
                  onDelete={() => {
                    if (confirmAction(`Xóa tài nguyên "${r.title}"?`)) void act(() => deleteResource(r.id))
                  }}
                />
              ))}
            </ul>
          )}
        </>
      }
      form={
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-semibold">{editing ? 'Sửa tài nguyên' : 'Thêm tài nguyên'}</h2>
          <Field
            label="Tên tài nguyên"
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field
            label="Liên kết"
            placeholder="https://..."
            value={url}
            error={badUrl ? 'Liên kết phải bắt đầu bằng https://' : undefined}
            onChange={(e) => setUrl(e.target.value)}
          />
          <SelectField
            label="Loại"
            options={RESOURCE_KINDS.map((k) => ({ value: k, label: RESOURCE_KIND_LABELS[k] }))}
            value={kind}
            onChange={(e) => setKind(e.target.value as ResourceKind)}
          />
          <TextareaField
            label="Mô tả"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
          <CheckboxField label="Hiển thị" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={!title.trim() || !url.trim() || badUrl}>
              {editing ? 'Lưu tài nguyên' : 'Thêm tài nguyên'}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={reset}>
                Hủy
              </Button>
            )}
          </div>
        </form>
      }
    />
  )
}
