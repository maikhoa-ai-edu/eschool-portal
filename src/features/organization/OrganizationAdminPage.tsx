import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { CheckboxField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import {
  deleteMember,
  deleteUnit,
  fetchOrganization,
  ORGANIZATION_KEY,
  reorder,
  saveMember,
  saveUnit,
  type OrgMember,
  type OrgUnit,
} from './api'
import { MemberAvatar } from './OrganizationList'

type Editing =
  { kind: 'unit'; unit: OrgUnit | null } | { kind: 'member'; unitId: string; member: OrgMember | null }

const iconButton = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'

function swap<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const next = [...list]
  ;[next[index], next[index + delta]] = [next[index + delta]!, next[index]!]
  return next
}

function UnitForm({
  unit,
  order,
  onDone,
}: {
  unit: OrgUnit | null
  order: number
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState(unit?.name ?? '')
  const [description, setDescription] = useState(unit?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Vui lòng nhập tên bộ phận.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveUnit(
        { name: name.trim(), description: description.trim() || null, sort_order: unit?.sort_order ?? order },
        unit?.id,
      )
      await onDone()
    } catch (err) {
      setError(toVietnameseError(err))
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
      <h2 className="font-bold">{unit ? 'Sửa bộ phận' : 'Thêm bộ phận'}</h2>
      {error && <Alert tone="danger" title={error} />}
      <Field
        label="Tên bộ phận"
        placeholder="Ban giám hiệu, Tổ văn phòng, Tổ chuyên môn 1..."
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Mô tả ngắn"
        value={description}
        maxLength={200}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button type="submit" loading={busy}>
        Lưu bộ phận
      </Button>
    </form>
  )
}

function MemberForm({
  unitId,
  member,
  order,
  onDone,
}: {
  unitId: string
  member: OrgMember | null
  order: number
  onDone: () => Promise<void>
}) {
  const [fullName, setFullName] = useState(member?.full_name ?? '')
  const [position, setPosition] = useState(member?.position ?? '')
  const [startYear, setStartYear] = useState(member?.start_year ? String(member.start_year) : '')
  const [qualification, setQualification] = useState(member?.qualification ?? '')
  const [subjects, setSubjects] = useState(member?.subjects ?? '')
  const [avatar, setAvatar] = useState(member?.avatar_path ?? null)
  const [visible, setVisible] = useState(member?.is_visible ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const year = startYear.trim() ? Number(startYear) : null
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên.')
      return
    }
    if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) {
      setError('Năm vào ngành phải từ 1950 đến 2100.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveMember(
        {
          unit_id: unitId,
          full_name: fullName.trim(),
          position: position.trim() || null,
          start_year: year,
          qualification: qualification.trim() || null,
          subjects: subjects.trim() || null,
          avatar_path: avatar,
          is_visible: visible,
          sort_order: member?.sort_order ?? order,
        },
        member?.id,
      )
      await onDone()
    } catch (err) {
      setError(toVietnameseError(err))
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
      <h2 className="font-bold">{member ? 'Sửa thành viên' : 'Thêm thành viên'}</h2>
      {error && <Alert tone="danger" title={error} />}
      <Field label="Họ tên" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} />
      <Field
        label="Chức vụ"
        placeholder="Hiệu trưởng, Tổ trưởng, Giáo viên..."
        value={position}
        maxLength={120}
        onChange={(e) => setPosition(e.target.value)}
      />
      <Field
        label="Năm vào ngành"
        type="number"
        min={1950}
        max={2100}
        value={startYear}
        onChange={(e) => setStartYear(e.target.value)}
      />
      <Field
        label="Trình độ chuyên môn"
        placeholder="Đại học Sư phạm Toán, Thạc sĩ..."
        value={qualification}
        maxLength={160}
        onChange={(e) => setQualification(e.target.value)}
      />
      <Field
        label="Môn phụ trách"
        value={subjects}
        maxLength={160}
        onChange={(e) => setSubjects(e.target.value)}
      />
      <ImageUploadField label="Ảnh đại diện" value={avatar} onChange={setAvatar} folder="organization" />
      <CheckboxField
        label="Hiện trên trang công khai"
        hint="Bỏ chọn nếu người này không muốn công khai thông tin."
        checked={visible}
        onChange={(e) => setVisible(e.target.checked)}
      />
      <Button type="submit" loading={busy}>
        Lưu thành viên
      </Button>
    </form>
  )
}

export function OrganizationAdminPage() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({
    queryKey: [...ORGANIZATION_KEY, 'admin'],
    queryFn: () => fetchOrganization(false),
  })
  const [editing, setEditing] = useState<Editing>({ kind: 'unit', unit: null })
  const [formKey, setFormKey] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const units = data ?? []

  const refresh = () => queryClient.invalidateQueries({ queryKey: ORGANIZATION_KEY })
  const edit = (next: Editing) => {
    setEditing(next)
    setFormKey((k) => k + 1)
  }
  const finish = async () => {
    await refresh()
    edit({ kind: 'unit', unit: null })
  }
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      setActionError(toVietnameseError(err))
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Cơ cấu tổ chức"
        description="Bộ phận và thành viên hiện ở trang dùng bố cục “Cơ cấu tổ chức”. Danh sách này không liên quan đến tài khoản đăng nhập."
      />
      <QueryState isPending={isPending} error={error} />
      {actionError && (
        <div className="mb-4">
          <Alert tone="danger" title={actionError} />
        </div>
      )}
      {data && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {units.length === 0 && <EmptyState title="Chưa có bộ phận nào" />}
            {units.map((unit, unitIndex) => (
              <Panel key={unit.id}>
                <div className="flex flex-wrap items-center gap-1">
                  <h2 className="min-w-0 flex-1 font-bold text-primary">{unit.name}</h2>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={unitIndex === 0}
                    aria-label={`Chuyển ${unit.name} lên`}
                    onClick={() => void run(() => reorder('org_units', swap(units, unitIndex, -1)))}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={unitIndex === units.length - 1}
                    aria-label={`Chuyển ${unit.name} xuống`}
                    onClick={() => void run(() => reorder('org_units', swap(units, unitIndex, 1)))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Sửa ${unit.name}`}
                    onClick={() => edit({ kind: 'unit', unit })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${iconButton} text-danger`}
                    aria-label={`Xóa ${unit.name}`}
                    onClick={() => {
                      const count = unit.org_members.length
                      if (confirmAction(`Xóa "${unit.name}" và ${count} thành viên trong đó?`))
                        void run(() => deleteUnit(unit.id))
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ul className="divide-y divide-border">
                  {unit.org_members.map((member, i) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-2 py-2">
                      <MemberAvatar member={member} />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold">
                          {member.full_name} {!member.is_visible && <Badge>Đang ẩn</Badge>}
                        </p>
                        <p className="text-muted">
                          {[member.position, member.subjects].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={i === 0}
                        aria-label={`Chuyển ${member.full_name} lên`}
                        onClick={() => void run(() => reorder('org_members', swap(unit.org_members, i, -1)))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={i === unit.org_members.length - 1}
                        aria-label={`Chuyển ${member.full_name} xuống`}
                        onClick={() => void run(() => reorder('org_members', swap(unit.org_members, i, 1)))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`Sửa ${member.full_name}`}
                        onClick={() => edit({ kind: 'member', unitId: unit.id, member })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`${iconButton} text-danger`}
                        aria-label={`Xóa ${member.full_name}`}
                        onClick={() => {
                          if (confirmAction(`Xóa "${member.full_name}"?`))
                            void run(() => deleteMember(member.id))
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => edit({ kind: 'member', unitId: unit.id, member: null })}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Thêm thành viên vào {unit.name}
                </Button>
              </Panel>
            ))}
          </div>
          <Panel>
            {editing.kind === 'unit' ? (
              <UnitForm key={formKey} unit={editing.unit} order={units.length} onDone={finish} />
            ) : (
              <MemberForm
                key={formKey}
                unitId={editing.unitId}
                member={editing.member}
                order={units.find((u) => u.id === editing.unitId)?.org_members.length ?? 0}
                onDone={finish}
              />
            )}
            {(editing.kind === 'member' || editing.unit) && (
              <Button variant="ghost" size="sm" onClick={() => edit({ kind: 'unit', unit: null })}>
                Hủy, thêm bộ phận mới
              </Button>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
