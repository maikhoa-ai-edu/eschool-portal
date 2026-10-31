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
import { RichContent } from '@/components/content/RichContent'
import { RichEditor } from '@/components/editor/RichEditor'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField, TextareaField } from '@/components/ui/FormControls'
import { useAuth } from '@/features/auth/auth-context'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { slugify, SLUG_PATTERN } from '@/lib/slug'
import {
  deleteNews,
  fetchCategories,
  fetchNewsForEdit,
  NEWS_KEY,
  saveNews,
  type EditableNews,
  type NewsCategory,
} from '../api'
import {
  actionDoneMessage,
  actionLabel,
  NEWS_STATUS_LABELS,
  NEWS_STATUS_TONES,
  newsWorkflow,
  parseTags,
  targetStatus,
  type NewsAction,
} from '../workflow'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(300, 'Tiêu đề quá dài'),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang'),
  excerpt: z.string().max(500, 'Tối đa 500 ký tự'),
  content: z.string(),
  category_id: z.string().min(1, 'Vui lòng chọn chuyên mục'),
  author_name: z.string().trim().max(150),
  source_name: z.string().trim().max(200),
  source_url: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^https?:\/\/\S+$/, 'Liên kết phải bắt đầu bằng https://'),
  ]),
  tags: z.string(),
  thumbnail_url: z.string().nullable(),
  is_featured: z.boolean(),
})
type Values = z.infer<typeof schema>

const ACTION_VARIANTS: Record<NewsAction, 'primary' | 'outline' | 'danger' | 'accent'> = {
  save_draft: 'outline',
  save: 'outline',
  withdraw: 'outline',
  submit: 'primary',
  publish: 'primary',
  reject: 'accent',
  unpublish: 'danger',
}

function NewsForm({ news, categories }: { news: EditableNews | null; categories: NewsCategory[] }) {
  const { profile, can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<NewsAction | 'delete' | null>(null)
  const [slugTouched, setSlugTouched] = useState(Boolean(news))

  const canPublish = can('news.publish')
  const status = news?.status ?? null
  const workflow = newsWorkflow(status, {
    canPublish,
    canEditAny: can('news.edit_any'),
    isAuthor: !news || news.author_id === profile?.id,
  })
  const canDelete =
    news && (can('news.delete') || (news.author_id === profile?.id && news.status === 'draft'))

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: news?.title ?? '',
      slug: news?.slug ?? '',
      excerpt: news?.excerpt ?? '',
      content: news?.content ?? '',
      category_id: news?.category_id ?? categories.find((c) => c.is_active)?.id ?? '',
      author_name: news?.author_name ?? '',
      source_name: news?.source_name ?? '',
      source_url: news?.source_url ?? '',
      tags: news?.tags.join(', ') ?? '',
      thumbnail_url: news?.thumbnail_url ?? null,
      is_featured: news?.is_featured ?? false,
    },
  })
  const e = form.formState.errors
  const slug = useWatch({ control: form.control, name: 'slug' })

  const categoryOptions = categories
    .filter((c) => c.is_active || c.id === news?.category_id)
    .map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (đã ẩn)` }))

  const run = async (action: NewsAction, values: Values) => {
    setError(null)
    setMessage(null)
    if ((action === 'submit' || action === 'publish') && !values.content.trim()) {
      form.setError('content', { message: 'Nội dung không được để trống khi gửi duyệt hoặc đăng' })
      return
    }
    let reviewNote = news?.review_note ?? null
    if (action === 'reject') {
      const note = window.prompt('Góp ý cho tác giả (lý do trả lại):', '')
      if (note === null) return
      reviewNote = note.trim() || 'Bài cần chỉnh sửa thêm.'
    } else if (action === 'submit' || action === 'publish') {
      reviewNote = null
    }
    if (action === 'unpublish' && !confirmAction('Gỡ bài khỏi trang công khai?')) return

    setBusy(action)
    try {
      const id = await saveNews(
        {
          title: values.title,
          slug: values.slug,
          excerpt: values.excerpt,
          content: values.content,
          thumbnail_url: values.thumbnail_url,
          category_id: values.category_id,
          author_name: values.author_name,
          source_name: values.source_name,
          source_url: values.source_url,
          tags: parseTags(values.tags),
          status: targetStatus(action, status),
          review_note: reviewNote,
          ...(canPublish ? { is_featured: values.is_featured } : {}),
        },
        news?.id,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NEWS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      ])
      const done = actionDoneMessage(action)
      if (!news) navigate(`/admin/tin-tuc/${id}`, { replace: true, state: { message: done } })
      else setMessage(done)
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!news || !confirmAction(`Xóa vĩnh viễn bài "${news.title}"?`)) return
    setBusy('delete')
    try {
      await deleteNews(news.id)
      await queryClient.invalidateQueries({ queryKey: NEWS_KEY })
      navigate('/admin/tin-tuc', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setBusy(null)
    }
  }

  const header = (
    <AdminPageHeader
      title={news ? 'Sửa bài viết' : 'Viết bài mới'}
      backTo="/admin/tin-tuc"
      actions={
        news?.status === 'published' ? (
          <Link
            to={`/tin-tuc/${news.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Xem trên trang <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : news ? (
          <Link
            to={`/tin-tuc/${news.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Xem trước <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : undefined
      }
    />
  )

  if (news && !workflow.editable) {
    return (
      <div>
        {header}
        <div className="space-y-4">
          <Alert tone="info" title="Bài viết đã được xuất bản">
            Chỉ quản trị viên được sửa bài đã đăng hoặc đã gỡ. Liên hệ quản trị viên nếu cần điều chỉnh.
          </Alert>
          <Panel>
            <h2 className="text-lg font-bold">{news.title}</h2>
            <RichContent html={news.content} />
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-5 xl:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          {message && <Alert tone="success" title={message} />}
          {error && <Alert tone="danger" title={error} />}
          {news?.review_note && news.status === 'draft' && (
            <Alert tone="warning" title="Góp ý của người duyệt">
              {news.review_note}
            </Alert>
          )}
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
              hint={`Địa chỉ bài viết: /tin-tuc/${slug || '...'}`}
              error={e.slug?.message}
              {...form.register('slug', { onChange: () => setSlugTouched(true) })}
            />
            <TextareaField
              label="Tóm tắt"
              hint="Hiện ở danh sách tin và khi chia sẻ lên mạng xã hội (tối đa 500 ký tự)."
              error={e.excerpt?.message}
              {...form.register('excerpt')}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Nội dung</p>
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <RichEditor
                    label="Nội dung bài viết"
                    initialValue={field.value}
                    onChange={field.onChange}
                    uploadFolder="news"
                    invalid={Boolean(e.content)}
                  />
                )}
              />
              {e.content && <p className="text-xs text-danger">{e.content.message}</p>}
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Xuất bản">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Trạng thái</span>
              {status ? (
                <Badge tone={NEWS_STATUS_TONES[status]}>{NEWS_STATUS_LABELS[status]}</Badge>
              ) : (
                <Badge>Bài mới</Badge>
              )}
            </div>
            {news?.author && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Tác giả</span>
                <span>{news.author.full_name}</span>
              </div>
            )}
            {news?.published_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Ngày đăng</span>
                <span>{formatDateTime(news.published_at)}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-1">
              {workflow.actions.map((action) => (
                <Button
                  key={action}
                  variant={ACTION_VARIANTS[action]}
                  loading={busy === action}
                  disabled={busy !== null}
                  onClick={() => void form.handleSubmit((values) => run(action, values))()}
                >
                  {actionLabel(action, status)}
                </Button>
              ))}
              {canDelete && (
                <Button
                  variant="ghost"
                  loading={busy === 'delete'}
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa bài
                </Button>
              )}
            </div>
            {!canPublish && (
              <p className="text-xs text-muted">
                Bài viết cần quản trị viên duyệt trước khi hiện trên trang.
              </p>
            )}
          </Panel>

          <Panel title="Phân loại">
            <SelectField
              label="Chuyên mục"
              options={categoryOptions}
              placeholder={categoryOptions.length === 0 ? 'Chưa có chuyên mục' : undefined}
              error={e.category_id?.message}
              {...form.register('category_id')}
            />
            <Field
              label="Thẻ"
              hint="Cách nhau bằng dấu phẩy, vd: khai giảng, học sinh giỏi"
              {...form.register('tags')}
            />
            {canPublish && (
              <CheckboxField
                label="Tin nổi bật"
                hint="Ưu tiên hiển thị ở trang chủ."
                {...form.register('is_featured')}
              />
            )}
          </Panel>

          <Panel title="Tác giả và nguồn">
            <Field
              label="Tên tác giả"
              hint="Hiện cuối bài. Để trống thì dùng tên tài khoản người viết."
              error={e.author_name?.message}
              {...form.register('author_name')}
            />
            <Field
              label="Nguồn bài viết"
              placeholder="vd: Báo Giáo dục và Thời đại"
              error={e.source_name?.message}
              {...form.register('source_name')}
            />
            <Field
              label="Liên kết nguồn"
              placeholder="https://..."
              error={e.source_url?.message}
              {...form.register('source_url')}
            />
          </Panel>

          <Panel title="Ảnh đại diện">
            <Controller
              control={form.control}
              name="thumbnail_url"
              render={({ field }) => (
                <ImageUploadField
                  label="Ảnh đại diện bài viết"
                  value={field.value}
                  onChange={field.onChange}
                  folder="news"
                  hint="Nên dùng ảnh ngang tỉ lệ 16:9."
                />
              )}
            />
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export function NewsEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const news = useQuery({
    queryKey: [...NEWS_KEY, 'edit', id],
    queryFn: () => fetchNewsForEdit(id!),
    enabled: !isNew,
  })
  const categories = useQuery({ queryKey: [...NEWS_KEY, 'categories'], queryFn: fetchCategories })

  const pending = categories.isPending || (!isNew && news.isPending)
  const error = categories.error ?? news.error
  if (pending || error) return <QueryState isPending={pending} error={error} />
  if (!isNew && !news.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy bài viết" backTo="/admin/tin-tuc" />
        <Alert tone="warning" title="Bài viết không tồn tại hoặc bạn không có quyền xem." />
      </div>
    )
  }
  return <NewsForm key={id ?? 'new'} news={news.data ?? null} categories={categories.data!} />
}
