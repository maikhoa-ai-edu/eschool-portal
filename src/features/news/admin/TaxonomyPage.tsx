import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState, TableCard } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { slugify, SLUG_PATTERN } from '@/lib/slug'
import {
  deleteCategory,
  deleteTag,
  fetchCategories,
  fetchTagsWithUsage,
  NEWS_KEY,
  renameTag,
  saveCategory,
  type NewsCategory,
} from '../api'

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên chuyên mục').max(100),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang'),
  description: z.string().trim().max(300),
  sort_order: z.coerce.number<string>().int('Nhập số nguyên'),
  is_active: z.boolean(),
})
type CategoryValues = z.input<typeof categorySchema>

function CategoryForm({
  category,
  nextOrder,
  onDone,
}: {
  category: NewsCategory | null
  nextOrder: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(Boolean(category))
  const form = useForm<CategoryValues, unknown, z.output<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      sort_order: String(category?.sort_order ?? nextOrder),
      is_active: category?.is_active ?? true,
    },
  })
  const e = form.formState.errors
  const slug = useWatch({ control: form.control, name: 'slug' })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await saveCategory(values, category?.id)
      await queryClient.invalidateQueries({ queryKey: NEWS_KEY })
      onDone()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <h2 className="font-semibold">{category ? `Sửa chuyên mục "${category.name}"` : 'Thêm chuyên mục'}</h2>
      {error && <Alert tone="danger" title={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tên chuyên mục"
          error={e.name?.message}
          {...form.register('name', {
            onChange: (event: { target: { value: string } }) => {
              if (!slugTouched) form.setValue('slug', slugify(event.target.value))
            },
          })}
        />
        <Field
          label="Đường dẫn"
          hint={`/tin-tuc/chuyen-muc/${slug || '...'}`}
          error={e.slug?.message}
          {...form.register('slug', { onChange: () => setSlugTouched(true) })}
        />
      </div>
      <TextareaField
        label="Mô tả"
        rows={2}
        error={e.description?.message}
        {...form.register('description')}
      />
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Field label="Thứ tự" type="number" error={e.sort_order?.message} {...form.register('sort_order')} />
        <CheckboxField
          label="Hiển thị trên trang công khai"
          className="pb-2"
          {...form.register('is_active')}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {category ? 'Lưu chuyên mục' : 'Thêm chuyên mục'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Hủy
        </Button>
      </div>
    </form>
  )
}

function CategoriesSection() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...NEWS_KEY, 'categories'],
    queryFn: fetchCategories,
  })
  const [editing, setEditing] = useState<NewsCategory | 'new' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const remove = async (category: NewsCategory) => {
    if (!confirmAction(`Xóa chuyên mục "${category.name}"?`)) return
    setActionError(null)
    try {
      await deleteCategory(category.id)
      await queryClient.invalidateQueries({ queryKey: NEWS_KEY })
    } catch (err) {
      setActionError(toVietnameseError(err))
    }
  }

  return (
    <Panel title="Chuyên mục">
      <QueryState isPending={isPending} error={error} />
      {actionError && <Alert tone="danger" title={actionError} />}
      {editing ? (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          nextOrder={(data?.length ?? 0) + 1}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden /> Thêm chuyên mục
        </Button>
      )}
      {data && (
        <TableCard>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Đường dẫn</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td className="text-muted">{c.slug}</td>
                <td>{c.sort_order}</td>
                <td>{c.is_active ? <Badge tone="success">Hiển thị</Badge> : <Badge>Đang ẩn</Badge>}</td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Sửa ${c.name}`}
                    onClick={() => setEditing(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Xóa ${c.name}`}
                    onClick={() => void remove(c)}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </Panel>
  )
}

function TagsSection() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...NEWS_KEY, 'tags'],
    queryFn: fetchTagsWithUsage,
  })
  const [actionError, setActionError] = useState<string | null>(null)

  const act = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: NEWS_KEY })
    } catch (err) {
      setActionError(toVietnameseError(err))
    }
  }

  return (
    <Panel title="Thẻ">
      <p className="text-sm text-muted">
        Thẻ được tạo khi soạn bài. Ở đây có thể đổi tên hoặc xóa thẻ không còn dùng.
      </p>
      <QueryState isPending={isPending} error={error} />
      {actionError && <Alert tone="danger" title={actionError} />}
      {data && data.length === 0 && <p className="text-sm text-muted">Chưa có thẻ nào.</p>}
      {data && data.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {data.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-1 rounded-full border border-border bg-bg py-1 pl-3 pr-1 text-sm"
            >
              <span>{tag.name}</span>
              <span className="text-xs text-muted">({tag.usage})</span>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-surface"
                aria-label={`Đổi tên thẻ ${tag.name}`}
                onClick={() => {
                  const name = window.prompt('Tên mới của thẻ:', tag.name)?.trim()
                  if (name && name !== tag.name) void act(() => renameTag(tag.id, name))
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-surface"
                aria-label={`Xóa thẻ ${tag.name}`}
                onClick={() => {
                  if (confirmAction(`Xóa thẻ "${tag.name}" khỏi ${tag.usage} bài viết?`))
                    void act(() => deleteTag(tag.id))
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function TaxonomyPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader title="Chuyên mục & thẻ" description="Phân loại bài viết để người đọc dễ tìm." />
      <CategoriesSection />
      <TagsSection />
    </div>
  )
}
