import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SelectField } from '@/components/ui/FormControls'
import { toVietnameseError } from '@/lib/errors'
import {
  CONTENT_GROUPS_KEY,
  deleteContentGroup,
  fetchContentGroups,
  groupOptions,
  saveContentGroup,
  type ContentGroup,
  type GroupScope,
} from './api'

function GroupsPage({
  scope,
  title,
  description,
  backTo,
  nested,
}: {
  scope: GroupScope
  title: string
  description: string
  backTo: string
  nested: boolean
}) {
  const queryClient = useQueryClient()
  const key = [...CONTENT_GROUPS_KEY, scope]
  const {
    data = [],
    isPending,
    error,
  } = useQuery({ queryKey: key, queryFn: () => fetchContentGroups(scope) })
  const [editing, setEditing] = useState<ContentGroup | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setEditing(null)
    setName('')
    setParentId('')
  }
  const act = async (task: () => Promise<void>) => {
    setActionError(null)
    setBusy(true)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: CONTENT_GROUPS_KEY })
      reset()
    } catch (err) {
      setActionError(toVietnameseError(err))
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const order = data.reduce((max, g) => Math.max(max, g.sort_order), -1) + 1
    void act(() =>
      saveContentGroup(scope, { name: name.trim(), parent_id: parentId || null }, editing?.id ?? null, order),
    )
  }
  // Chỉ hai cấp: mục đang có con không được đưa vào làm con
  const hasChildren = editing ? data.some((g) => g.parent_id === editing.id) : false
  const parents = data.filter((g) => !g.parent_id && g.id !== editing?.id)

  return (
    <div>
      <AdminPageHeader title={title} description={description} backTo={backTo} />
      <QueryState isPending={isPending} error={error} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          {actionError && <Alert tone="danger" title={actionError} />}
          {data.length === 0 ? (
            <p className="text-sm text-muted">Chưa có mục nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {groupOptions(data).map((option) => {
                const group = data.find((g) => g.id === option.value)!
                return (
                  <li key={group.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Sửa "${group.name}"`}
                      onClick={() => {
                        setEditing(group)
                        setName(group.name)
                        setParentId(group.parent_id ?? '')
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Xóa "${group.name}"`}
                      onClick={() => {
                        const note = 'Nội dung bên trong không bị xóa, chỉ không còn thuộc mục này.'
                        if (confirmAction(`Xóa "${group.name}"? ${note}`))
                          void act(() => deleteContentGroup(group.id))
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        <Panel title={editing ? `Sửa "${editing.name}"` : 'Thêm mục'}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Tên" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            {nested && !hasChildren && (
              <SelectField
                label="Thuộc thư mục"
                placeholder="(Thư mục cấp 1)"
                options={parents.map((g) => ({ value: g.id, label: g.name }))}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button type="submit" loading={busy} disabled={!name.trim()}>
                {editing ? 'Lưu' : 'Thêm'}
              </Button>
              {editing && (
                <Button variant="ghost" onClick={reset}>
                  Hủy
                </Button>
              )}
            </div>
          </form>
        </Panel>
      </div>
    </div>
  )
}

export function AnnouncementGroupsPage() {
  return (
    <GroupsPage
      scope="announcement"
      title="Phân loại thông báo"
      description="Hiện ở cột phải trang Thông báo để lọc nhanh."
      backTo="/admin/thong-bao"
      nested={false}
    />
  )
}

export function DocumentFoldersPage() {
  return (
    <GroupsPage
      scope="document"
      title="Thư mục văn bản"
      description="Cây thư mục hai cấp hiện ở cột phải trang Văn bản."
      backTo="/admin/van-ban"
      nested
    />
  )
}
