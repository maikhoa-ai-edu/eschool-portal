import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, Star, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SelectField, TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { slugify, SLUG_PATTERN } from '@/lib/slug'
import { cn } from '@/lib/cn'
import {
  addImages,
  ALBUMS_KEY,
  deleteAlbum,
  fetchAlbum,
  moveItem,
  removeImage,
  saveAlbum,
  saveOrder,
  setCover,
  updateCaption,
  type AlbumDetail,
  type AlbumImage,
} from '../api'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên album').max(200),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang'),
  description: z.string().trim().max(1000, 'Tối đa 1000 ký tự'),
  event_date: z.string(),
  status: z.enum(['draft', 'published']),
})
type Values = z.infer<typeof schema>

function AlbumInfoForm({ album }: { album: AlbumDetail | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(Boolean(album))
  const [deleting, setDeleting] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: album?.title ?? '',
      slug: album?.slug ?? '',
      description: album?.description ?? '',
      event_date: album?.event_date ?? '',
      status: album?.status === 'published' ? 'published' : 'draft',
    },
  })
  const e = form.formState.errors
  const slug = useWatch({ control: form.control, name: 'slug' })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    setMessage(null)
    try {
      const id = await saveAlbum(values, album?.id)
      await queryClient.invalidateQueries({ queryKey: ALBUMS_KEY })
      if (!album) {
        navigate(`/admin/thu-vien-anh/${id}`, {
          replace: true,
          state: { message: 'Đã tạo album. Tiếp tục tải ảnh lên bên dưới.' },
        })
      } else setMessage('Đã lưu thông tin album.')
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const remove = async () => {
    if (!album || !confirmAction(`Xóa album "${album.title}" cùng ${album.images.length} ảnh?`)) return
    setDeleting(true)
    try {
      await deleteAlbum(album)
      await queryClient.invalidateQueries({ queryKey: ALBUMS_KEY })
      navigate('/admin/thu-vien-anh', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setDeleting(false)
    }
  }

  return (
    <Panel title="Thông tin album">
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
        {message && <Alert tone="success" title={message} />}
        {error && <Alert tone="danger" title={error} />}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Tên album"
            error={e.title?.message}
            {...form.register('title', {
              onChange: (event: { target: { value: string } }) => {
                if (!slugTouched) form.setValue('slug', slugify(event.target.value))
              },
            })}
          />
          <Field
            label="Đường dẫn"
            hint={`/thu-vien-anh/${slug || '...'}`}
            error={e.slug?.message}
            {...form.register('slug', { onChange: () => setSlugTouched(true) })}
          />
          <Field label="Ngày diễn ra" type="date" {...form.register('event_date')} />
          <SelectField
            label="Trạng thái"
            options={[
              { value: 'draft', label: 'Nháp (chưa hiện trên trang)' },
              { value: 'published', label: 'Đã đăng' },
            ]}
            {...form.register('status')}
          />
        </div>
        <TextareaField
          label="Mô tả"
          rows={2}
          error={e.description?.message}
          {...form.register('description')}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.formState.isSubmitting} disabled={deleting}>
            {album ? 'Lưu thông tin' : 'Tạo album'}
          </Button>
          {album && (
            <Button variant="ghost" loading={deleting} onClick={() => void remove()}>
              <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa album
            </Button>
          )}
        </div>
      </form>
    </Panel>
  )
}

function ImageTile({
  image,
  index,
  total,
  isCover,
  busy,
  onAction,
}: {
  image: AlbumImage
  index: number
  total: number
  isCover: boolean
  busy: boolean
  onAction: (action: 'cover' | 'left' | 'right' | 'delete' | 'caption') => void
}) {
  const iconButton =
    'flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-text shadow hover:bg-white disabled:opacity-40'
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-[4/3] bg-bg">
        <img
          src={image.url}
          alt={image.caption ?? image.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {isCover && (
          <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            Ảnh bìa
          </span>
        )}
        <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
          <div className="flex gap-1">
            <button
              type="button"
              className={iconButton}
              disabled={busy || index === 0}
              aria-label="Chuyển ảnh lên trước"
              onClick={() => onAction('left')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={busy || index === total - 1}
              aria-label="Chuyển ảnh ra sau"
              onClick={() => onAction('right')}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1">
            {!isCover && (
              <button
                type="button"
                className={iconButton}
                disabled={busy}
                aria-label="Đặt làm ảnh bìa"
                title="Đặt làm ảnh bìa"
                onClick={() => onAction('cover')}
              >
                <Star className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              className={cn(iconButton, 'text-danger')}
              disabled={busy}
              aria-label="Xóa ảnh"
              onClick={() => onAction('delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="block w-full truncate px-2 py-1.5 text-left text-xs text-muted hover:text-primary"
        onClick={() => onAction('caption')}
        disabled={busy}
      >
        {image.caption || 'Thêm chú thích...'}
      </button>
    </li>
  )
}

function AlbumImages({ album }: { album: AlbumDetail }) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ALBUMS_KEY })

  const upload = async (files: File[]) => {
    setErrors([])
    setProgress({ done: 0, total: files.length })
    const failed = await addImages(album, files, (done) => setProgress({ done, total: files.length }))
    setErrors(failed)
    setProgress(null)
    await refresh()
  }

  const act = async (
    image: AlbumImage,
    index: number,
    action: 'cover' | 'left' | 'right' | 'delete' | 'caption',
  ) => {
    setErrors([])
    let task: (() => Promise<void>) | null = null
    if (action === 'cover') task = () => setCover(album.id, image.mediaId)
    if (action === 'left' || action === 'right')
      task = () => saveOrder(album.id, moveItem(album.images, index, action === 'left' ? -1 : 1))
    if (action === 'delete' && confirmAction('Xóa ảnh này khỏi album?')) task = () => removeImage(image)
    if (action === 'caption') {
      const caption = window.prompt('Chú thích ảnh:', image.caption ?? '')
      if (caption !== null) task = () => updateCaption(album.id, image.mediaId, caption)
    }
    if (!task) return
    setBusy(true)
    try {
      await task()
      await refresh()
    } catch (err) {
      setErrors([toVietnameseError(err)])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={`Ảnh trong album (${album.images.length})`}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => fileInput.current?.click()}
          loading={progress !== null}
          disabled={busy || progress !== null}
        >
          <ImagePlus className="h-4 w-4" aria-hidden /> Tải ảnh lên
        </Button>
        {progress ? (
          <span className="text-sm text-muted" role="status">
            Đang tải {progress.done}/{progress.total} ảnh...
          </span>
        ) : (
          <span className="text-xs text-muted">Chọn được nhiều ảnh cùng lúc. Ảnh lớn được tự thu nhỏ.</span>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-label="Chọn ảnh tải lên album"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) void upload(files)
          }}
        />
      </div>
      {errors.length > 0 && (
        <Alert tone="danger" title="Một số thao tác không thành công">
          <ul className="list-disc pl-4">
            {errors.map((err) => (
              <li key={err}>{toVietnameseError(err)}</li>
            ))}
          </ul>
        </Alert>
      )}
      {album.images.length === 0 ? (
        <p className="text-sm text-muted">Album chưa có ảnh.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {album.images.map((image, index) => (
            <ImageTile
              key={image.mediaId}
              image={image}
              index={index}
              total={album.images.length}
              isCover={image.mediaId === album.cover_media_id}
              busy={busy || progress !== null}
              onAction={(action) => void act(image, index, action)}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function AlbumEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: [...ALBUMS_KEY, 'edit', id],
    queryFn: () => fetchAlbum(id!),
    enabled: Boolean(id),
  })
  if (id && (query.isPending || query.error))
    return <QueryState isPending={query.isPending} error={query.error} />
  if (id && !query.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy album" backTo="/admin/thu-vien-anh" />
        <Alert tone="warning" title="Album không tồn tại hoặc đã bị xóa." />
      </div>
    )
  }
  const album = query.data ?? null
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={album ? album.title : 'Tạo album'}
        backTo="/admin/thu-vien-anh"
        actions={
          album && (
            <Link
              to={`/thu-vien-anh/${album.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {album.status === 'published' ? 'Xem trên trang' : 'Xem trước'}{' '}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )
        }
      />
      <AlbumInfoForm key={id ?? 'new'} album={album} />
      {album && <AlbumImages album={album} />}
    </div>
  )
}
