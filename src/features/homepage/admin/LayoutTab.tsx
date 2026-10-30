import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/FormControls'
import { fetchCategories, NEWS_KEY } from '@/features/news/api'
import {
  moveSection,
  SECTION_INFO,
  type HomepageSection,
  type HomepageSettings,
} from '@/features/site/homepage-settings'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { saveSetting } from '../api'

const MODULE_LABELS: Record<string, string> = {
  news: 'Tin tức',
  albums: 'Thư viện ảnh',
  announcements: 'Thông báo',
  documents: 'Văn bản',
}

const MAX_CATEGORIES = 6

function SectionRow({
  section,
  first,
  last,
  onChange,
  onMove,
  extra,
}: {
  section: HomepageSection
  first: boolean
  last: boolean
  onChange: (patch: Partial<HomepageSection>) => void
  onMove: (delta: -1 | 1) => void
  extra?: React.ReactNode
}) {
  const { isModuleEnabled } = useSite()
  const info = SECTION_INFO[section.key]
  const moduleOff = info.module !== null && !isModuleEnabled(info.module)
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'
  return (
    <li className={cn('space-y-3 border-b border-border p-3 last:border-0', !section.enabled && 'bg-bg/60')}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-40 flex-1 items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--brand-primary)]"
          />
          {info.label}
        </label>
        <input
          aria-label={`Tiêu đề khối ${info.label}`}
          value={section.title}
          placeholder={info.defaultTitle || 'Tên chuyên mục'}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={80}
          className="h-9 w-48 rounded-lg border border-border bg-surface px-2 text-sm"
        />
        {info.maxLimit > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-muted">
            Số mục
            <input
              type="number"
              min={1}
              max={info.maxLimit}
              value={section.limit}
              aria-label={`Số mục khối ${info.label}`}
              onChange={(e) =>
                onChange({ limit: Math.min(info.maxLimit, Math.max(1, Number(e.target.value) || 1)) })
              }
              className="h-9 w-16 rounded-lg border border-border bg-surface px-2 text-sm text-text"
            />
          </label>
        )}
        <div className="flex">
          <button
            type="button"
            className={icon}
            disabled={first}
            aria-label={`Chuyển khối ${info.label} lên`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={icon}
            disabled={last}
            aria-label={`Chuyển khối ${info.label} xuống`}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      {moduleOff && section.enabled && (
        <p className="text-xs text-accent">
          Module {MODULE_LABELS[info.module!]} đang tắt nên khối này tạm không hiện.
        </p>
      )}
      {extra}
    </li>
  )
}

export function LayoutTab() {
  const { homepage } = useSite()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<HomepageSettings>(homepage)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const { data: categories = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'categories'],
    queryFn: fetchCategories,
  })

  const update = (key: HomepageSection['key'], patch: Partial<HomepageSection>) =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)) }))

  const toggleCategory = (id: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      category_ids: on
        ? [...d.category_ids, id].slice(0, MAX_CATEGORIES)
        : d.category_ids.filter((c) => c !== id),
    }))

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      // Số khởi điểm bộ đếm sửa ở tab khác: luôn lấy giá trị đang lưu
      await saveSetting('homepage', { ...draft, visit_counter_offset: homepage.visit_counter_offset })
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
      setMessage({ tone: 'success', text: 'Đã lưu bố cục. Trang chủ đã cập nhật.' })
    } catch (err) {
      setMessage({ tone: 'danger', text: toVietnameseError(err) })
    } finally {
      setSaving(false)
    }
  }

  const column = (area: 'main' | 'sidebar', title: string) => {
    const list = draft.sections.filter((s) => SECTION_INFO[s.key].area === area)
    return (
      <Panel title={title}>
        <ul className="overflow-hidden rounded-lg border border-border">
          {list.map((section, i) => (
            <SectionRow
              key={section.key}
              section={section}
              first={i === 0}
              last={i === list.length - 1}
              onChange={(patch) => update(section.key, patch)}
              onMove={(delta) =>
                setDraft((d) => ({ ...d, sections: moveSection(d.sections, section.key, delta) }))
              }
              extra={
                section.key === 'category_news' && (
                  <fieldset className="space-y-1.5 pl-6">
                    <legend className="text-xs text-muted">
                      Chọn chuyên mục hiện thành từng khối riêng (tối đa {MAX_CATEGORIES}):
                    </legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {categories
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <label key={c.id} className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.category_ids.includes(c.id)}
                              onChange={(e) => toggleCategory(c.id, e.target.checked)}
                              className="accent-[var(--brand-primary)]"
                            />
                            {c.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                )
              }
            />
          ))}
        </ul>
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      {message && <Alert tone={message.tone} title={message.text} />}
      <Panel title="Slide đầu trang">
        <div className="flex flex-wrap items-center gap-6">
          <CheckboxField
            label="Hiện slide ở đầu trang chủ"
            checked={draft.show_slides}
            onChange={(e) => setDraft((d) => ({ ...d, show_slides: e.target.checked }))}
          />
          <label className="flex items-center gap-2 text-sm">
            Chuyển ảnh sau
            <input
              type="number"
              min={3}
              max={30}
              value={draft.slide_interval}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  slide_interval: Math.min(30, Math.max(3, Number(e.target.value) || 6)),
                }))
              }
              className="h-9 w-16 rounded-lg border border-border bg-surface px-2"
            />
            giây
          </label>
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        {column('main', 'Cột chính')}
        {column('sidebar', 'Cột phải')}
      </div>
      <p className="text-xs text-muted">
        Bỏ trống ô tiêu đề để dùng tên mặc định. Khối không có nội dung sẽ tự ẩn.
      </p>
      <Button onClick={() => void save()} loading={saving}>
        Lưu bố cục
      </Button>
    </div>
  )
}
