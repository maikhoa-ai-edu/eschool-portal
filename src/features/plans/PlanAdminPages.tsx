import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, FileUp, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState, TableCard } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { TextareaField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import { deletePlan, fetchPlan, fetchPlanItems, fetchPlans, PLANS_KEY, savePlan, type WorkPlan } from './api'
import type { PlanRow } from './docx'

export function PlanListPage() {
  const { data, isPending, error } = useQuery({
    queryKey: [...PLANS_KEY, 'admin'],
    queryFn: () => fetchPlans(false),
  })
  return (
    <div>
      <AdminPageHeader
        title="Kế hoạch công tác"
        description="Mỗi tháng một kế hoạch, nhập từng hàng hoặc lấy từ file Word."
        actions={
          <Link to="/admin/ke-hoach/moi" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Lập kế hoạch
          </Link>
        }
      />
      <QueryState isPending={isPending} error={error} />
      {data && data.length === 0 && <EmptyState title="Chưa có kế hoạch nào" />}
      {data && data.length > 0 && (
        <TableCard>
          <thead>
            <tr>
              <th scope="col">Tháng</th>
              <th scope="col">Tiêu đề</th>
              <th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">
                  {p.month}/{p.year}
                </td>
                <td>
                  <Link to={`/admin/ke-hoach/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td>
                  {p.status === 'published' ? <Badge tone="success">Đã đăng</Badge> : <Badge>Nháp</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  )
}

interface EditRow extends PlanRow {
  key: number
}

let nextKey = 0
const toEditRow = (row: PlanRow): EditRow => ({ ...row, key: nextKey++ })
const emptyRow = (): EditRow => toEditRow({ time_text: '', content: '', assignee: '' })

function PlanForm({ plan, initialRows }: { plan: WorkPlan | null; initialRows: PlanRow[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [now] = useState(() => new Date())
  const [year, setYear] = useState(plan?.year ?? now.getFullYear())
  const [month, setMonth] = useState(plan?.month ?? now.getMonth() + 1)
  const [title, setTitle] = useState(plan?.title ?? '')
  const [note, setNote] = useState(plan?.note ?? '')
  const [rows, setRows] = useState<EditRow[]>(() =>
    initialRows.length > 0 ? initialRows.map(toEditRow) : [emptyRow()],
  )
  const [pdf, setPdf] = useState<File | null>(null)
  const [removePdf, setRemovePdf] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null)
  const docxInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

  const setRow = (key: number, patch: Partial<PlanRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const move = (index: number, delta: -1 | 1) =>
    setRows((list) => {
      const next = [...list]
      ;[next[index], next[index + delta]] = [next[index + delta]!, next[index]!]
      return next
    })
  const filled = rows.filter((r) => r.content.trim() || r.time_text.trim() || r.assignee.trim())
  const missingContent = filled.some((r) => !r.content.trim())
  const finalTitle = title.trim() || `Kế hoạch công tác tháng ${month}/${year}`

  // Thư viện đọc file chỉ tải khi dùng
  const importDocx = async (file: File) => {
    setNotice(null)
    try {
      const { parseDocxPlan } = await import('./docx')
      const parsed = await parseDocxPlan(file)
      if (parsed.length === 0) {
        setNotice({ tone: 'warning', text: 'Không tìm thấy bảng kế hoạch trong file. Hãy nhập từng hàng.' })
        return
      }
      const replace =
        filled.length === 0 ||
        confirmAction(`Thay ${filled.length} hàng đang có bằng ${parsed.length} hàng từ file?`)
      if (!replace) return
      setRows(parsed.map(toEditRow))
      setNotice({
        tone: 'success',
        text: `Đã lấy ${parsed.length} hàng từ file. Hãy xem lại rồi bấm Lưu.`,
      })
    } catch (err) {
      setNotice({ tone: 'danger', text: toVietnameseError(err) })
    }
  }

  const save = async (status: 'draft' | 'published') => {
    if (missingContent) {
      setNotice({ tone: 'danger', text: 'Hàng nào đã nhập cũng cần có nội dung công việc.' })
      return
    }
    if (status === 'published' && filled.length === 0 && !pdf && (!plan?.file_path || removePdf)) {
      setNotice({ tone: 'danger', text: 'Kế hoạch cần có ít nhất một hàng hoặc file PDF.' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const id = await savePlan(
        {
          year,
          month,
          title: finalTitle,
          note: note.trim(),
          status,
          rows: filled.map(({ time_text, content, assignee }) => ({
            time_text: time_text.trim(),
            content: content.trim(),
            assignee: assignee.trim(),
          })),
          pdf,
          removePdf,
        },
        plan,
      )
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY })
      setPdf(null)
      setRemovePdf(false)
      if (!plan) navigate(`/admin/ke-hoach/${id}`, { replace: true })
      else setNotice({ tone: 'success', text: status === 'published' ? 'Đã đăng kế hoạch.' : 'Đã lưu nháp.' })
    } catch (err) {
      const text = toVietnameseError(err)
      setNotice({
        tone: 'danger',
        text: /duplicate|unique|đã tồn tại/i.test(text) ? `Tháng ${month}/${year} đã có kế hoạch.` : text,
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!plan || !confirmAction(`Xóa kế hoạch tháng ${plan.month}/${plan.year}?`)) return
    setBusy(true)
    try {
      await deletePlan(plan)
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY })
      navigate('/admin/ke-hoach', { replace: true })
    } catch (err) {
      setNotice({ tone: 'danger', text: toVietnameseError(err) })
      setBusy(false)
    }
  }

  const input = 'h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm'
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'
  return (
    <div className="space-y-5">
      <AdminPageHeader title={plan ? 'Sửa kế hoạch' : 'Lập kế hoạch'} backTo="/admin/ke-hoach" />
      {notice && <Alert tone={notice.tone} title={notice.text} />}
      <Panel>
        <div className="grid gap-4 sm:grid-cols-[6rem_8rem_1fr]">
          <Field
            label="Tháng"
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
          />
          <Field
            label="Năm"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Math.min(2100, Math.max(2000, Number(e.target.value) || year)))}
          />
          <Field
            label="Tiêu đề"
            placeholder={`Kế hoạch công tác tháng ${month}/${year}`}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <TextareaField
          label="Ghi chú"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Panel>
      <Panel title="Nội dung kế hoạch">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => docxInput.current?.click()}>
            <FileUp className="h-4 w-4" aria-hidden /> Nhập từ file Word
          </Button>
          <p className="text-xs text-muted">
            File .docx có bảng gồm các cột Thời gian, Nội dung, Bộ phận/người thực hiện.
          </p>
          <input
            ref={docxInput}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            tabIndex={-1}
            aria-label="Chọn file Word kế hoạch"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importDocx(file)
            }}
          />
        </div>
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid items-start gap-2 rounded-lg border border-border p-2 md:grid-cols-[9rem_1fr_13rem_auto] md:border-0 md:p-0"
            >
              <input
                value={row.time_text}
                placeholder="Thời gian"
                aria-label={`Thời gian hàng ${index + 1}`}
                onChange={(e) => setRow(row.key, { time_text: e.target.value })}
                className={input}
              />
              <textarea
                value={row.content}
                rows={1}
                placeholder="Nội dung công việc"
                aria-label={`Nội dung hàng ${index + 1}`}
                onChange={(e) => setRow(row.key, { content: e.target.value })}
                className="min-h-9 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              />
              <input
                value={row.assignee}
                placeholder="Bộ phận / người thực hiện"
                aria-label={`Người thực hiện hàng ${index + 1}`}
                onChange={(e) => setRow(row.key, { assignee: e.target.value })}
                className={input}
              />
              <div className="flex">
                <button
                  type="button"
                  className={icon}
                  disabled={index === 0}
                  aria-label={`Chuyển hàng ${index + 1} lên`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={icon}
                  disabled={index === rows.length - 1}
                  aria-label={`Chuyển hàng ${index + 1} xuống`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${icon} text-danger`}
                  aria-label={`Xóa hàng ${index + 1}`}
                  onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={() => setRows((list) => [...list, emptyRow()])}>
          <Plus className="h-4 w-4" aria-hidden /> Thêm hàng
        </Button>
      </Panel>
      <Panel title="File PDF đính kèm">
        <p className="text-sm text-muted">
          PDF không lưu cấu trúc bảng nên không tự điền được các hàng. File được đính kèm để xem và tải về.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => pdfInput.current?.click()}>
            Chọn file PDF
          </Button>
          {pdf && <span className="text-sm">{pdf.name}</span>}
          {!pdf && plan?.file_name && !removePdf && (
            <>
              <span className="text-sm">{plan.file_name}</span>
              <Button variant="ghost" size="sm" onClick={() => setRemovePdf(true)}>
                Bỏ file
              </Button>
            </>
          )}
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Chọn file PDF kế hoạch"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) {
                setPdf(file)
                setRemovePdf(false)
              }
            }}
          />
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save('published')} loading={busy}>
          {plan?.status === 'published' ? 'Lưu thay đổi' : 'Đăng kế hoạch'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void save('draft')}>
          {plan?.status === 'published' ? 'Chuyển về nháp' : 'Lưu nháp'}
        </Button>
        {plan && (
          <Button variant="ghost" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa
          </Button>
        )}
      </div>
    </div>
  )
}

export function PlanEditorPage() {
  const { id } = useParams()
  const plan = useQuery({
    queryKey: [...PLANS_KEY, 'edit', id],
    queryFn: () => fetchPlan(id!),
    enabled: Boolean(id),
  })
  const items = useQuery({
    queryKey: [...PLANS_KEY, 'edit-items', id],
    queryFn: () => fetchPlanItems(id!),
    enabled: Boolean(id),
  })
  if (!id) return <PlanForm plan={null} initialRows={[]} />
  if (plan.isPending || items.isPending || plan.error || items.error) {
    return <QueryState isPending={plan.isPending || items.isPending} error={plan.error ?? items.error} />
  }
  if (!plan.data) return <EmptyState title="Không tìm thấy kế hoạch" />
  return <PlanForm key={plan.data.id} plan={plan.data} initialRows={items.data} />
}
