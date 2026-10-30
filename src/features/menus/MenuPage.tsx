import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowDown, ArrowUp, CornerDownRight, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, SelectField } from '@/components/ui/FormControls'
import { buildMenuTree, type TreeNode as Tree } from '@/features/site/menu'
import { DEFAULT_MENU_ICON, MENU_ICONS, MenuIcon } from '@/features/site/menu-icons'
import { MOBILE_BAR_MAX_ITEMS } from '@/layouts/public/MobileBottomBar'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import {
  deleteMenuItem,
  fetchLinkSuggestions,
  fetchMenuItems,
  fetchMenus,
  MENU_URL_PATTERN,
  MENUS_ADMIN_KEY,
  PUBLIC_MENU_KEY,
  saveMenuItem,
  saveSiblingOrder,
  setMenuItemActive,
  type AdminMenuItem,
} from './api'

const schema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên mục').max(100),
  url: z
    .string()
    .trim()
    .regex(MENU_URL_PATTERN, 'Đường dẫn bắt đầu bằng / (trong website) hoặc https:// (website khác)'),
  parent_id: z.string(),
  open_in_new_tab: z.boolean(),
  icon: z.string().nullable(),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

type Editing = { item: AdminMenuItem | null; parentId: string | null }

/** Ô chọn icon: nhóm nút radio, chọn "Mặc định" thì lưu null. */
function IconPicker({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const selected = value && MENU_ICONS[value] ? value : DEFAULT_MENU_ICON
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">Icon</legend>
      <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {Object.entries(MENU_ICONS).map(([key, { label, icon: Icon }]) => (
          <label
            key={key}
            title={label}
            className={cn(
              'flex h-9 cursor-pointer items-center justify-center rounded-md hover:bg-bg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
              selected === key && 'bg-primary text-white hover:bg-primary',
            )}
          >
            <input
              type="radio"
              name="menu-icon"
              aria-label={label}
              checked={selected === key}
              onChange={() => onChange(key === DEFAULT_MENU_ICON ? null : key)}
              className="sr-only"
            />
            <Icon className="h-4 w-4" aria-hidden />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ItemForm({
  menuId,
  location,
  editing,
  items,
  onDone,
}: {
  menuId: string
  location: string
  editing: Editing
  items: AdminMenuItem[]
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { isModuleEnabled } = useSite()
  const [error, setError] = useState<string | null>(null)
  const suggestions = useQuery({
    queryKey: [...MENUS_ADMIN_KEY, 'suggestions'],
    queryFn: () => fetchLinkSuggestions(isModuleEnabled),
  })
  const { item } = editing
  const hasChildren = item ? items.some((i) => i.parent_id === item.id) : false
  const isMobileBar = location === 'mobile_bar'
  // Chỉ hai cấp: mục cha phải là mục gốc; mục đang có con thì không đưa vào làm con
  const parentOptions = hasChildren
    ? []
    : items
        .filter((i) => i.parent_id === null && i.id !== item?.id)
        .map((i) => ({ value: i.id, label: i.title }))

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: item?.title ?? '',
      url: item?.url ?? '',
      parent_id: item?.parent_id ?? editing.parentId ?? '',
      open_in_new_tab: item?.open_in_new_tab ?? false,
      icon: item?.icon ?? null,
      is_active: item?.is_active ?? true,
    },
  })
  const e = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const parentId = values.parent_id || null
    try {
      await saveMenuItem(
        menuId,
        { ...values, parent_id: parentId },
        item,
        items.filter((i) => i.parent_id === parentId && i.id !== item?.id),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MENUS_ADMIN_KEY }),
        queryClient.invalidateQueries({ queryKey: PUBLIC_MENU_KEY }),
      ])
      onDone()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  const groups = [...new Set((suggestions.data ?? []).map((s) => s.group))]

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <h2 className="font-semibold">{item ? `Sửa mục "${item.title}"` : 'Thêm mục menu'}</h2>
      {error && <Alert tone="danger" title={error} />}
      {suggestions.data && suggestions.data.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="menu-suggestion" className="block text-sm font-medium">
            Chọn nhanh liên kết
          </label>
          <select
            id="menu-suggestion"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value=""
            onChange={(event) => {
              const picked = suggestions.data.find((s) => s.url === event.target.value)
              if (!picked) return
              form.setValue('url', picked.url, { shouldValidate: true })
              if (!form.getValues('title').trim())
                form.setValue('title', picked.title, { shouldValidate: true })
            }}
          >
            <option value="">— Chọn trang có sẵn —</option>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {suggestions.data
                  .filter((s) => s.group === group)
                  .map((s) => (
                    <option key={s.url} value={s.url}>
                      {s.title} ({s.url})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <Field label="Tên hiển thị" error={e.title?.message} {...form.register('title')} />
      <Field
        label="Đường dẫn"
        placeholder="/trang/gioi-thieu hoặc https://..."
        error={e.url?.message}
        {...form.register('url')}
      />
      {location !== 'footer' && (
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
        />
      )}
      {!isMobileBar && (
        <SelectField
          label="Thuộc mục"
          options={parentOptions}
          placeholder="(Mục cấp 1)"
          hint={hasChildren ? 'Mục này đang có mục con nên phải ở cấp 1.' : undefined}
          {...form.register('parent_id')}
        />
      )}
      <CheckboxField label="Mở trong tab mới" {...form.register('open_in_new_tab')} />
      <CheckboxField label="Hiển thị" {...form.register('is_active')} />
      <div className="flex gap-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {item ? 'Lưu mục' : 'Thêm mục'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Hủy
        </Button>
      </div>
    </form>
  )
}

type TreeNode = Tree<AdminMenuItem>

function ItemRow({
  node,
  index,
  siblings,
  depth,
  busy,
  canNest,
  onEdit,
  onAddChild,
  onMove,
  onToggle,
  onDelete,
}: {
  node: TreeNode
  index: number
  siblings: TreeNode[]
  depth: number
  busy: boolean
  canNest: boolean
  onEdit: (node: TreeNode) => void
  onAddChild: (node: TreeNode) => void
  onMove: (siblings: TreeNode[], index: number, delta: -1 | 1) => void
  onToggle: (node: TreeNode) => void
  onDelete: (node: TreeNode) => void
}) {
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'
  return (
    <li>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b border-border px-3 py-2',
          depth > 0 && 'pl-8',
          !node.is_active && 'opacity-60',
        )}
      >
        {depth > 0 && <CornerDownRight className="h-4 w-4 text-muted" aria-hidden />}
        <MenuIcon name={node.icon} className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {node.title} {!node.is_active && <Badge>Đang ẩn</Badge>}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            {node.url} {node.open_in_new_tab && <ExternalLink className="h-3 w-3" aria-label="Mở tab mới" />}
          </p>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            className={icon}
            disabled={busy || index === 0}
            aria-label={`Chuyển "${node.title}" lên`}
            onClick={() => onMove(siblings, index, -1)}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={icon}
            disabled={busy || index === siblings.length - 1}
            aria-label={`Chuyển "${node.title}" xuống`}
            onClick={() => onMove(siblings, index, 1)}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <label className="mx-1 flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={node.is_active}
              disabled={busy}
              onChange={() => onToggle(node)}
              aria-label={`Hiển thị "${node.title}"`}
              className="accent-[var(--brand-primary)]"
            />
            Hiện
          </label>
          {depth === 0 && canNest && (
            <button
              type="button"
              className={icon}
              disabled={busy}
              aria-label={`Thêm mục con cho "${node.title}"`}
              title="Thêm mục con"
              onClick={() => onAddChild(node)}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className={icon}
            disabled={busy}
            aria-label={`Sửa "${node.title}"`}
            onClick={() => onEdit(node)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(icon, 'text-danger')}
            disabled={busy}
            aria-label={`Xóa "${node.title}"`}
            onClick={() => onDelete(node)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <ItemRow
              key={child.id}
              node={child}
              index={i}
              siblings={node.children}
              depth={depth + 1}
              busy={busy}
              canNest={canNest}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onMove={onMove}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function MenuEditor({ menuId, location }: { menuId: string; location: string }) {
  const queryClient = useQueryClient()
  const {
    data: items,
    isPending,
    error,
  } = useQuery({
    queryKey: [...MENUS_ADMIN_KEY, 'items', menuId],
    queryFn: () => fetchMenuItems(menuId),
  })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isPending || error) return <QueryState isPending={isPending} error={error} />
  const byId = new Map(items.map((i) => [i.id, i]))
  const tree = buildMenuTree(items)

  const act = async (task: () => Promise<void>) => {
    setActionError(null)
    setBusy(true)
    try {
      await task()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MENUS_ADMIN_KEY }),
        queryClient.invalidateQueries({ queryKey: PUBLIC_MENU_KEY }),
      ])
    } catch (err) {
      setActionError(toVietnameseError(err))
    } finally {
      setBusy(false)
    }
  }

  const move = (siblings: TreeNode[], index: number, delta: -1 | 1) => {
    const ordered = siblings.map((s) => byId.get(s.id)!)
    const target = index + delta
    ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
    void act(() => saveSiblingOrder(ordered))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        {actionError && <Alert tone="danger" title={actionError} />}
        {location === 'mobile_bar' && (
          <p className="text-sm text-muted">
            Thanh cố định ở đáy màn hình điện thoại. Chỉ hiện {MOBILE_BAR_MAX_ITEMS} mục đầu tiên đang bật;
            xóa hết mục thì thanh không hiện.
          </p>
        )}
        {tree.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Menu chưa có mục nào.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-surface [&>li:last-child>div]:border-0">
            {tree.map((node, index) => (
              <ItemRow
                key={node.id}
                node={node}
                index={index}
                siblings={tree}
                depth={0}
                busy={busy}
                canNest={location !== 'mobile_bar'}
                onEdit={(n) => setEditing({ item: byId.get(n.id)!, parentId: n.parent_id })}
                onAddChild={(n) => setEditing({ item: null, parentId: n.id })}
                onMove={move}
                onToggle={(n) => void act(() => setMenuItemActive(n.id, !n.is_active))}
                onDelete={(n) => {
                  const extra = n.children.length > 0 ? ` và ${n.children.length} mục con` : ''
                  if (confirmAction(`Xóa mục "${n.title}"${extra}?`)) void act(() => deleteMenuItem(n.id))
                }}
              />
            ))}
          </ul>
        )}
      </div>
      <Panel>
        {editing ? (
          <ItemForm
            key={editing.item?.id ?? `new-${editing.parentId ?? 'root'}`}
            menuId={menuId}
            location={location}
            editing={editing}
            items={items}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-3 text-sm text-muted">
            <p>Bấm biểu tượng bút để sửa, dấu + để thêm mục con. Thay đổi hiện ra trang công khai ngay.</p>
            <Button onClick={() => setEditing({ item: null, parentId: null })}>
              <Plus className="h-4 w-4" aria-hidden /> Thêm mục menu
            </Button>
          </div>
        )}
      </Panel>
    </div>
  )
}

export function MenuPage() {
  const {
    data: menus,
    isPending,
    error,
  } = useQuery({
    queryKey: [...MENUS_ADMIN_KEY, 'menus'],
    queryFn: fetchMenus,
  })
  const [selected, setSelected] = useState<string | null>(null)
  const menuId = selected ?? menus?.[0]?.id ?? null
  const location = menus?.find((m) => m.id === menuId)?.location ?? 'header'

  return (
    <div>
      <AdminPageHeader
        title="Menu"
        description="Menu chính ở đầu trang, thanh đáy trên điện thoại và liên kết nhanh ở chân trang."
      />
      <QueryState isPending={isPending} error={error} />
      {menus && (
        <div role="tablist" aria-label="Chọn menu" className="mb-4 flex flex-wrap gap-1">
          {menus.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === menuId}
              onClick={() => setSelected(m.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                m.id === menuId ? 'bg-primary text-white' : 'bg-surface hover:bg-bg',
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
      {menuId && <MenuEditor key={menuId} menuId={menuId} location={location} />}
    </div>
  )
}
