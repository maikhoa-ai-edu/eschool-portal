import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { FileText, Trash2, Upload } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField, TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { formatFileSize } from '@/lib/format'
import {
  asDocumentStatus,
  deleteDocument,
  describeDocumentProblem,
  DOCUMENT_ACCEPT,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  DOCUMENTS_KEY,
  documentDownloadUrl,
  fetchDocument,
  isDocumentType,
  saveDocument,
  type DocumentRecord,
} from '../api'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên văn bản').max(500),
  document_number: z.string().trim().max(100),
  document_type: z.enum(DOCUMENT_TYPES),
  issuing_authority: z.string().trim().max(200),
  signer: z.string().trim().max(200),
  issue_date: z.string(),
  effective_date: z.string(),
  excerpt: z.string().trim().max(1000, 'Tối đa 1000 ký tự'),
  is_featured: z.boolean(),
  status: z.enum(DOCUMENT_STATUSES),
})
type Values = z.infer<typeof schema>

function DocumentForm({ doc }: { doc: DocumentRecord | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: doc?.title ?? '',
      document_number: doc?.document_number ?? '',
      document_type: doc && isDocumentType(doc.document_type) ? doc.document_type : 'ke_hoach',
      issuing_authority: doc?.issuing_authority ?? '',
      signer: doc?.signer ?? '',
      issue_date: doc?.issue_date ?? '',
      effective_date: doc?.effective_date ?? '',
      excerpt: doc?.excerpt ?? '',
      is_featured: doc?.is_featured ?? false,
      status: asDocumentStatus(doc?.status ?? 'published'),
    },
  })
  const e = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    setMessage(null)
    if (!doc && !file) {
      setFileError('Vui lòng chọn file văn bản')
      return
    }
    try {
      const id = await saveDocument(values, file, doc)
      await queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY })
      setFile(null)
      if (!doc) navigate(`/admin/van-ban/${id}`, { replace: true, state: { message: 'Đã lưu văn bản.' } })
      else setMessage('Đã lưu văn bản.')
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const remove = async () => {
    if (!doc || !confirmAction(`Xóa văn bản "${doc.title}" và file đính kèm?`)) return
    setDeleting(true)
    try {
      await deleteDocument(doc)
      await queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY })
      navigate('/admin/van-ban', { replace: true })
    } catch (err) {
      setError(toVietnameseError(err))
      setDeleting(false)
    }
  }

  return (
    <div>
      <AdminPageHeader title={doc ? 'Sửa văn bản' : 'Thêm văn bản'} backTo="/admin/van-ban" />
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5 xl:grid-cols-[1fr_320px]"
      >
        <div className="space-y-5">
          {message && <Alert tone="success" title={message} />}
          {error && <Alert tone="danger" title={error} />}
          <Panel>
            <Field label="Tên văn bản (trích yếu)" error={e.title?.message} {...form.register('title')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Số hiệu"
                placeholder="vd 125/KH-THPT"
                error={e.document_number?.message}
                {...form.register('document_number')}
              />
              <SelectField
                label="Loại văn bản"
                options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))}
                {...form.register('document_type')}
              />
              <Field
                label="Cơ quan ban hành"
                error={e.issuing_authority?.message}
                {...form.register('issuing_authority')}
              />
              <Field label="Người ký" error={e.signer?.message} {...form.register('signer')} />
              <Field label="Ngày ban hành" type="date" {...form.register('issue_date')} />
              <Field label="Ngày hiệu lực" type="date" {...form.register('effective_date')} />
            </div>
            <TextareaField
              label="Tóm tắt nội dung"
              rows={4}
              error={e.excerpt?.message}
              {...form.register('excerpt')}
            />
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="File văn bản">
            {doc && !file && (
              <a
                href={documentDownloadUrl(doc)}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-bg"
              >
                <FileText className="h-8 w-8 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{doc.file_name}</span>
                  <span className="text-xs text-muted">{formatFileSize(doc.file_size)}</span>
                </span>
              </a>
            )}
            {file && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <FileText className="h-8 w-8 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{file.name}</span>
                  <span className="text-xs text-muted">{formatFileSize(file.size)} · sẽ tải lên khi lưu</span>
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden /> {doc || file ? 'Chọn file khác' : 'Chọn file'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="File văn bản"
              onChange={(event) => {
                const picked = event.target.files?.[0]
                event.target.value = ''
                if (!picked) return
                const problem = describeDocumentProblem(picked)
                setFileError(problem)
                setFile(problem ? null : picked)
              }}
            />
            {fileError ? (
              <p className="text-xs text-danger">{fileError}</p>
            ) : (
              <p className="text-xs text-muted">PDF, Word, Excel, PowerPoint; tối đa 25 MB.</p>
            )}
          </Panel>
          <Panel title="Công bố">
            <SelectField
              label="Trạng thái"
              options={DOCUMENT_STATUSES.map((s) => ({ value: s, label: DOCUMENT_STATUS_LABELS[s] }))}
              hint="Chỉ văn bản đã ban hành mới hiện trên trang công khai."
              {...form.register('status')}
            />
            <CheckboxField label="Văn bản nổi bật" {...form.register('is_featured')} />
            <div className="flex flex-col gap-2">
              <Button type="submit" loading={form.formState.isSubmitting} disabled={deleting}>
                Lưu văn bản
              </Button>
              {doc && (
                <Button variant="ghost" loading={deleting} onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa văn bản
                </Button>
              )}
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export function DocumentEditorPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'edit', id],
    queryFn: () => fetchDocument(id!),
    enabled: Boolean(id),
  })
  if (id && (query.isPending || query.error))
    return <QueryState isPending={query.isPending} error={query.error} />
  if (id && !query.data) {
    return (
      <div>
        <AdminPageHeader title="Không tìm thấy văn bản" backTo="/admin/van-ban" />
        <Alert tone="warning" title="Văn bản không tồn tại hoặc đã bị xóa." />
      </div>
    )
  }
  return <DocumentForm key={id ?? 'new'} doc={query.data ?? null} />
}
