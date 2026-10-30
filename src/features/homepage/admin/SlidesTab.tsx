import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowDown, ArrowUp, ImageOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField } from '@/components/ui/FormControls'
import { MENU_URL_PATTERN } from '@/features/menus/api'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import {
  deleteSlide,
  fetchSlides,
  HOMEPAGE_KEY,
  saveSlide,
  saveSlideOrder,
  setSlideActive,
  slideImageUrl,
  type Slide,
} from '../api'

const schema = z.object({
  image_path: z.string().min(1, 'Vui lòng chọn ảnh cho slide'),
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(150),
  subtitle: z.string().trim().max(200),
  link_url: z
    .string()
    .trim()
    .refine((v) => v === '' || MENU_URL_PATTERN.test(v), 'Bắt đầu bằng / (trong website) hoặc https://'),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

function SlideForm({
  slide,
  nextOrder,
  onDone,
}: {
  slide: Slide | null
  nextOrder: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      image_path: slide?.image_path ?? '',
      title: slide?.title ?? '',
      subtitle: slide?.subtitle ?? '',
      link_url: slide?.link_url ?? '',
      is_active: slide?.is_active ?? true,
    },
  })
  const e = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await saveSlide(values, slide?.id ?? null, nextOrder)
      await queryClient.invalidateQueries({ queryKey: HOMEPAGE_KEY })
      onDone()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <h2 className="font-semibold">{slide ? 'Sửa slide' : 'Thêm slide'}</h2>
      {error && <Alert tone="danger" title={error} />}
      <div>
        <Controller
          control={form.control}
          name="image_path"
          render={({ field }) => (
            <ImageUploadField
              label="Ảnh slide"
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              folder="slides"
              hint="Ảnh ngang, nên rộng từ 1600px. Chữ trên ảnh nên nằm ở phần trên để không bị tiêu đề che."
            />
          )}
        />
        {e.image_path && <p className="mt-1 text-xs text-danger">{e.image_path.message}</p>}
      </div>
      <Field label="Tiêu đề trên slide" error={e.title?.message} {...form.register('title')} />
      <Field label="Dòng mô tả (không bắt buộc)" error={e.subtitle?.message} {...form.register('subtitle')} />
      <Field
        label='Liên kết nút "Xem chi tiết" (không bắt buộc)'
        placeholder="/tin-tuc/... hoặc https://..."
        error={e.link_url?.message}
        {...form.register('link_url')}
      />
      <CheckboxField label="Hiển thị" {...form.register('is_active')} />
      <div className="flex gap-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {slide ? 'Lưu slide' : 'Thêm slide'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Hủy
        </Button>
      </div>
    </form>
  )
}

export function SlidesTab() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...HOMEPAGE_KEY, 'slides', 'admin'],
    queryFn: () => fetchSlides(false),
  })
  const [editing, setEditing] = useState<Slide | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isPending || error) return <QueryState isPending={isPending} error={error} />

  const act = async (task: () => Promise<void>) => {
    setActionError(null)
    setBusy(true)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: HOMEPAGE_KEY })
    } catch (err) {
      setActionError(toVietnameseError(err))
    } finally {
      setBusy(false)
    }
  }
  const move = (index: number, delta: -1 | 1) => {
    const ordered = [...data]
    ;[ordered[index], ordered[index + delta]] = [ordered[index + delta]!, ordered[index]!]
    void act(() => saveSlideOrder(ordered))
  }
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="space-y-3">
        {actionError && <Alert tone="danger" title={actionError} />}
        {data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Chưa có slide. Trang chủ sẽ bắt đầu bằng khối tin tức.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((slide, index) => (
              <li
                key={slide.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-2 pr-3',
                  !slide.is_active && 'opacity-60',
                )}
              >
                {slideImageUrl(slide) ? (
                  <img src={slideImageUrl(slide)} alt="" className="h-16 w-28 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-28 items-center justify-center rounded-lg bg-bg text-muted">
                    <ImageOff className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {slide.title} {!slide.is_active && <Badge>Đang ẩn</Badge>}
                  </p>
                  {slide.subtitle && <p className="truncate text-sm text-muted">{slide.subtitle}</p>}
                  {slide.link_url && <p className="truncate text-xs text-muted">→ {slide.link_url}</p>}
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    className={icon}
                    disabled={busy || index === 0}
                    aria-label={`Chuyển "${slide.title}" lên`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={icon}
                    disabled={busy || index === data.length - 1}
                    aria-label={`Chuyển "${slide.title}" xuống`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <label className="mx-1 flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={slide.is_active}
                      disabled={busy}
                      aria-label={`Hiển thị "${slide.title}"`}
                      onChange={() => void act(() => setSlideActive(slide.id, !slide.is_active))}
                      className="accent-[var(--brand-primary)]"
                    />
                    Hiện
                  </label>
                  <button
                    type="button"
                    className={icon}
                    disabled={busy}
                    aria-label={`Sửa "${slide.title}"`}
                    onClick={() => setEditing(slide)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(icon, 'text-danger')}
                    disabled={busy}
                    aria-label={`Xóa "${slide.title}"`}
                    onClick={() => {
                      if (confirmAction(`Xóa slide "${slide.title}"?`)) void act(() => deleteSlide(slide.id))
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Panel>
        {editing ? (
          <SlideForm
            key={editing === 'new' ? 'new' : editing.id}
            slide={editing === 'new' ? null : editing}
            nextOrder={data.length}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-3 text-sm text-muted">
            <p>Slide hiện ở đầu trang chủ và tự chuyển sau vài giây (đổi ở tab Bố cục).</p>
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" aria-hidden /> Thêm slide
            </Button>
          </div>
        )}
      </Panel>
    </div>
  )
}
