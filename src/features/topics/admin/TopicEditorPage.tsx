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
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField, TextareaField } from '@/components/ui/FormControls'
import { asPageStatus, PAGE_STATUS_LABELS, PAGE_STATUSES } from '@/features/pages/api'
import { toVietnameseError } from '@/lib/errors'
import { slugify, SLUG_PATTERN } from '@/lib/slug'
import { deleteTopic, fetchTopic, saveTopic, TOPICS_KEY, type Topic } from '../api'
import { describeSectionProblem, type TopicSection } from '../sections'
import { SectionsEditor } from './SectionsEditor'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang'),
  badge: z.string().trim().max(80),
  summary: z.string().trim().max(600, 'Tối đa 600 ký tự'),
  hero_image: z.string().nullable(),
  hero_color: z
    .string()
    .trim()
    .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Mã màu dạng #A80000'),
  quote_text: z.string().trim().max(600, 'Tối đa 600 ký tự'),
  quote_author: z.string().trim().max(120),
  status: z.enum(PAGE_STATUSES),
  sort_order: z.coerce.number<string>().int('Nhập số nguyên'),
  meta_title: z.string().trim().max(70, 'Tối đa 70 ký tự'),
  meta_description: z.string().trim().max(160, 'Tối đa 160 ký tự'),
  no_index: z.boolean(),
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

function TopicForm({ topic }: { topic: Topic | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [slugTouched, setSlugTouched] = useState(Boolean(topic))
  const [sections, setSections] = useState<TopicSection[]>(topic?.sections ?? [])

  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: topic?.title ?? '',
      slug: topic?.slug ?? '',
      badge: topic?.badge ?? '',
      summary: topic?.summary ?? '',
      hero_image: topic?.hero_image ?? null,
      hero_color: topic?.hero_color ?? '',
      quote_text: topic?.quote_text ?? '',
      quote_author: topic?.quote_author ?? '',
      status: asPageStatus(topic?.status ?? 'draft'),
      sort_order: String(topic?.sort_order ?? 0),
      meta_title: topic?.meta_title ?? '',
      meta_description: topic?.meta_description ?? '',
      no_index: topic?.no_index ?? false,
    },
  })
  const e = form.formState.errors
  const slug = useWatch({ control: form.control, name: 'slug' })
  const color = useWatch({ control: form.control, name: 'hero_color' })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    setMessage(null)
    const problem = sections.map(describeSectionProblem).find(Boolean)
    if (problem) {
      setError(problem)
      return
    }
    try {
      const id = await saveTopic({ ...values, sections }, topic?.id)
      await queryClient.invalidateQueries({ queryKey: TOPICS_KEY })
      if (!topic)
        navigate(`/admin/chuyen-de/${id}`, { replace: true, state: { message: 'Đã lưu chuyên đề.' } })
      else setMessage('Đã lưu chuyên đề.')
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const remove = async () => {
    if (
      !topic ||
      !confirmAction(
        `Xóa chuyên đề "${topic.title}"? Mục menu, banner trỏ tới trang này sẽ thành liên kết hỏng.`,
      )
    )
      return
    setDeleting(true)
    try {
      await deleteTopic(topic.id)
      await queryClient.invalidateQueries({ queryKey: TOPICS_KEY })
      navigate('/admin/chuyen-de', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setDeleting(false)
    }
  }

  return (
    <div>
      <AdminPageHeader
        title={topic ? 'Sửa chuyên đề' : 'Thêm chuyên đề'}
        backTo="/admin/chuyen-de"
        actions={
          topic && (
            <Link
              to={`/chuyen-de/${topic.slug}`}
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
        <div className="min-w-0 space-y-5">
          {message && <Alert tone="success" title={message} />}
          {error && <Alert tone="danger" title={error} />}
          <Panel title="Phần đầu trang">
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
              hint={`Địa chỉ trang: /chuyen-de/${slug || '...'}`}
              error={e.slug?.message}
              {...form.register('slug', { onChange: () => setSlugTouched(true) })}
            />
            <Field
              label="Nhãn nhỏ phía trên tiêu đề"
              placeholder="Chuyên đề năm học ..."
              error={e.badge?.message}
              {...form.register('badge')}
            />
            <TextareaField
              label="Lời giới thiệu"
              rows={3}
              error={e.summary?.message}
              {...form.register('summary')}
            />
            <TextareaField
              label="Lời trích nổi bật (không bắt buộc)"
              rows={3}
              error={e.quote_text?.message}
              {...form.register('quote_text')}
            />
            <Field
              label="Người nói / nguồn"
              error={e.quote_author?.message}
              {...form.register('quote_author')}
            />
          </Panel>
          <Panel title="Các khối nội dung">
            <p className="text-sm text-muted">
              Khối hiện theo thứ tự từ trên xuống. Khối chưa có nội dung sẽ tự ẩn ở trang công khai.
            </p>
            <SectionsEditor sections={sections} onChange={setSections} />
          </Panel>
          <Panel title="Tối ưu tìm kiếm (SEO)">
            <Field
              label="Tiêu đề SEO"
              hint="Để trống sẽ dùng tiêu đề chuyên đề."
              error={e.meta_title?.message}
              {...form.register('meta_title')}
            />
            <TextareaField
              label="Mô tả SEO"
              rows={2}
              error={e.meta_description?.message}
              {...form.register('meta_description')}
            />
            <CheckboxField label="Không cho Google lập chỉ mục" {...form.register('no_index')} />
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Đăng trang">
            <SelectField
              label="Trạng thái"
              options={PAGE_STATUSES.map((s) => ({ value: s, label: PAGE_STATUS_LABELS[s] }))}
              {...form.register('status')}
            />
            <Field
              label="Thứ tự"
              type="number"
              error={e.sort_order?.message}
              {...form.register('sort_order')}
            />
            <div className="flex flex-col gap-2">
              <Button type="submit" loading={form.formState.isSubmitting} disabled={deleting}>
                Lưu chuyên đề
              </Button>
              {topic && (
                <Button variant="ghost" loading={deleting} onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa chuyên đề
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Ảnh & màu nền">
            <Controller
              control={form.control}
              name="hero_image"
              render={({ field }) => (
                <ImageUploadField
                  label="Ảnh nền đầu trang"
                  value={field.value}
                  onChange={field.onChange}
                  folder="topics"
                  hint="Ảnh ngang, hiện mờ phía sau chữ."
                />
              )}
            />
            <Field
              label="Màu nền đầu trang"
              placeholder="#A80000"
              hint="Để trống sẽ dùng màu chính của trường."
              error={e.hero_color?.message}
              {...form.register('hero_color')}
            />
            {/^#[0-9a-fA-F]{6}$/.test(color) && (
              <div
                className="h-8 rounded-lg border border-border"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            )}
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export function TopicEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: [...TOPICS_KEY, 'edit', id],
    queryFn: () => fetchTopic(id!),
    enabled: Boolean(id),
  })
  if (id && (query.isPending || query.error))
    return <QueryState isPending={query.isPending} error={query.error} />
  if (id && !query.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy chuyên đề" backTo="/admin/chuyen-de" />
        <Alert tone="warning" title="Chuyên đề không tồn tại hoặc đã bị xóa." />
      </div>
    )
  }
  return <TopicForm key={id ?? 'new'} topic={query.data ?? null} />
}
