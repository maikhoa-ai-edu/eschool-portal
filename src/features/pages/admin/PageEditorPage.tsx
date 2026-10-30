import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { ExternalLink, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { RichEditor } from '@/components/editor/RichEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField, TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { slugify, SLUG_PATTERN } from '@/lib/slug'
import {
  asPageStatus,
  asPageTemplate,
  deletePage,
  fetchPage,
  PAGE_STATUS_LABELS,
  PAGE_STATUSES,
  PAGE_TEMPLATE_LABELS,
  PAGE_TEMPLATES,
  PAGES_KEY,
  savePage,
  type EditablePage,
} from '../api'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang'),
  content: z.string(),
  excerpt: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  featured_image_url: z.string().nullable(),
  template: z.enum(PAGE_TEMPLATES),
  status: z.enum(PAGE_STATUSES),
  sort_order: z.coerce.number<string>().int('Nhập số nguyên'),
  meta_title: z.string().trim().max(70, 'Tối đa 70 ký tự'),
  meta_description: z.string().trim().max(160, 'Tối đa 160 ký tự'),
  no_index: z.boolean(),
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

function PageForm({ page }: { page: EditablePage | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [slugTouched, setSlugTouched] = useState(Boolean(page))

  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: page?.title ?? '',
      slug: page?.slug ?? '',
      content: page?.content ?? '',
      excerpt: page?.excerpt ?? '',
      featured_image_url: page?.featured_image_url ?? null,
      template: asPageTemplate(page?.template ?? 'default'),
      status: asPageStatus(page?.status ?? 'published'),
      sort_order: String(page?.sort_order ?? 0),
      meta_title: page?.meta_title ?? '',
      meta_description: page?.meta_description ?? '',
      no_index: page?.no_index ?? false,
    },
  })
  const e = form.formState.errors
  const slug = useWatch({ control: form.control, name: 'slug' })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    setMessage(null)
    try {
      const id = await savePage(values, page?.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PAGES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['menu'] }),
      ])
      if (!page) navigate(`/admin/trang/${id}`, { replace: true, state: { message: 'Đã lưu trang.' } })
      else setMessage('Đã lưu trang.')
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const remove = async () => {
    if (
      !page ||
      !confirmAction(`Xóa trang "${page.title}"? Mục menu trỏ tới trang này sẽ thành liên kết hỏng.`)
    )
      return
    setDeleting(true)
    try {
      await deletePage(page.id)
      await queryClient.invalidateQueries({ queryKey: PAGES_KEY })
      navigate('/admin/trang', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setDeleting(false)
    }
  }

  return (
    <div>
      <AdminPageHeader
        title={page ? 'Sửa trang' : 'Thêm trang'}
        backTo="/admin/trang"
        actions={
          page && (
            <Link
              to={`/trang/${page.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Xem trang <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )
        }
      />
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5 xl:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          {message && <Alert tone="success" title={message} />}
          {error && <Alert tone="danger" title={error} />}
          <Panel>
            <Field
              label="Tiêu đề"
              error={e.title?.message}
              {...form.register('title', {
                onChange: (event: { target: { value: string } }) => {
                  if (!slugTouched) form.setValue('slug', slugify(event.target.value))
                },
              })}
            />
            <Field
              label="Đường dẫn"
              hint={`Địa chỉ trang: /trang/${slug || '...'}`}
              error={e.slug?.message}
              {...form.register('slug', { onChange: () => setSlugTouched(true) })}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Nội dung</p>
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <RichEditor
                    label="Nội dung trang"
                    initialValue={field.value}
                    onChange={field.onChange}
                    uploadFolder="pages"
                  />
                )}
              />
            </div>
          </Panel>
          <Panel title="Tối ưu tìm kiếm (SEO)">
            <Field
              label="Tiêu đề SEO"
              hint="Để trống sẽ dùng tiêu đề trang."
              error={e.meta_title?.message}
              {...form.register('meta_title')}
            />
            <TextareaField
              label="Mô tả SEO"
              rows={2}
              error={e.meta_description?.message}
              {...form.register('meta_description')}
            />
            <CheckboxField
              label="Không cho Google lập chỉ mục"
              hint="Dùng cho trang nội bộ, không muốn xuất hiện trong kết quả tìm kiếm."
              {...form.register('no_index')}
            />
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Đăng trang">
            <SelectField
              label="Trạng thái"
              options={PAGE_STATUSES.map((s) => ({ value: s, label: PAGE_STATUS_LABELS[s] }))}
              {...form.register('status')}
            />
            <SelectField
              label="Bố cục"
              options={PAGE_TEMPLATES.map((t) => ({ value: t, label: PAGE_TEMPLATE_LABELS[t] }))}
              {...form.register('template')}
            />
            <Field
              label="Thứ tự"
              type="number"
              error={e.sort_order?.message}
              {...form.register('sort_order')}
            />
            <div className="flex flex-col gap-2">
              <Button type="submit" loading={form.formState.isSubmitting} disabled={deleting}>
                Lưu trang
              </Button>
              {page && (
                <Button variant="ghost" loading={deleting} onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa trang
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Ảnh & tóm tắt">
            <Controller
              control={form.control}
              name="featured_image_url"
              render={({ field }) => (
                <ImageUploadField
                  label="Ảnh đầu trang"
                  value={field.value}
                  onChange={field.onChange}
                  folder="pages"
                />
              )}
            />
            <TextareaField
              label="Tóm tắt"
              rows={3}
              error={e.excerpt?.message}
              {...form.register('excerpt')}
            />
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export function PageEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: [...PAGES_KEY, 'edit', id],
    queryFn: () => fetchPage(id!),
    enabled: Boolean(id),
  })
  if (id && (query.isPending || query.error))
    return <QueryState isPending={query.isPending} error={query.error} />
  if (id && !query.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy trang" backTo="/admin/trang" />
        <Alert tone="warning" title="Trang không tồn tại hoặc đã bị xóa." />
      </div>
    )
  }
  return <PageForm key={id ?? 'new'} page={query.data ?? null} />
}
