import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { Field } from '@/components/ui/Field'
import { Panel } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/FormControls'
import { fetchCategories, NEWS_KEY } from '@/features/news/api'
import {
  allowedVariants,
  allowedZones,
  MAX_CATEGORY_BLOCKS,
  maxColumns,
  moveSection,
  moveToZone,
  newCategorySection,
  patchSection,
  resolveColumns,
  resolveVariant,
  SECTION_INFO,
  VARIANT_LABELS,
  ZONE_LABELS,
  type HomepageBanner,
  type HomepageSection,
  type HomepageSettings,
  type HomepageZone,
} from '@/features/site/homepage-settings'
import { MENU_ICONS } from '@/features/site/menu-icons'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { saveSetting } from '../api'
import { SHORTCUTS_MAX_ITEMS } from '../shortcuts'
import { writePreviewDraft } from '../preview'
import { LayoutMap, VariantThumb } from './LayoutMap'
import { applyDefaultLayout, applyPreset, LAYOUT_PRESETS, type LayoutPresetKey } from './presets'

const MODULE_LABELS: Record<string, string> = {
  news: 'Tin tức',
  albums: 'Thư viện ảnh',
  announcements: 'Thông báo',
  documents: 'Văn bản',
}

const SMALL_SELECT = 'h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text'

/** Ô chọn kiểu hiển thị có hình minh họa. */
function VariantPicker({
  section,
  label,
  onChange,
}: {
  section: HomepageSection
  label: string
  onChange: (patch: Partial<HomepageSection>) => void
}) {
  const current = resolveVariant(section)
  return (
    <fieldset>
      <legend className="sr-only">Kiểu hiển thị khối {label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {allowedVariants(section.zone).map((variant) => (
          <label
            key={variant}
            className={cn(
              'flex w-20 cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 text-center text-[11px] leading-tight has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
              current === variant
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border text-muted hover:bg-bg',
            )}
          >
            <input
              type="radio"
              name={`variant-${section.id}`}
              aria-label={`${VARIANT_LABELS[variant]} cho khối ${label}`}
              checked={current === variant}
              onChange={() => onChange({ variant })}
              className="sr-only"
            />
            <VariantThumb variant={variant} />
            {VARIANT_LABELS[variant]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SectionRow({
  section,
  label,
  first,
  last,
  onChange,
  onMove,
  onZone,
  onRemove,
  warning,
  extra,
}: {
  section: HomepageSection
  label: string
  first: boolean
  last: boolean
  onChange: (patch: Partial<HomepageSection>) => void
  onMove: (delta: -1 | 1) => void
  onZone: (zone: HomepageZone) => void
  onRemove?: () => void
  warning?: string
  extra?: React.ReactNode
}) {
  const { isModuleEnabled } = useSite()
  const info = SECTION_INFO[section.key]
  const moduleOff = info.module !== null && !isModuleEnabled(info.module)
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'
  const showColumns = info.columns || (info.newsVariants && resolveVariant(section) === 'grid')
  const columnChoices = ([2, 3, 4] as const).filter((n) => n <= maxColumns(section.zone, section.half))
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
          {label}
        </label>
        {section.key !== 'topic_banner' && (
          <input
            aria-label={`Tiêu đề khối ${label}`}
            value={section.title}
            placeholder={section.key === 'category_news' ? 'Tên chuyên mục' : info.defaultTitle || 'Không có'}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={80}
            className="h-9 w-48 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        )}
        {info.maxLimit > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-muted">
            Số mục
            <input
              type="number"
              min={1}
              max={info.maxLimit}
              value={section.limit}
              aria-label={`Số mục khối ${label}`}
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
            aria-label={`Chuyển khối ${label} lên`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={icon}
            disabled={last}
            aria-label={`Chuyển khối ${label} xuống`}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          {onRemove && (
            <button
              type="button"
              className={cn(icon, 'text-danger')}
              aria-label={`Bỏ khối ${label}`}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-6 text-sm text-muted">
        <label className="flex items-center gap-1.5">
          Vùng
          <select
            aria-label={`Vùng của khối ${label}`}
            value={section.zone}
            onChange={(e) => onZone(e.target.value as HomepageZone)}
            className={SMALL_SELECT}
          >
            {allowedZones(section.key).map((z) => (
              <option key={z} value={z}>
                {ZONE_LABELS[z]}
              </option>
            ))}
          </select>
        </label>
        {section.zone !== 'sidebar' && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              aria-label={`Khối ${label} rộng nửa trang`}
              checked={section.half}
              onChange={(e) => onChange({ half: e.target.checked })}
              className="accent-[var(--brand-primary)]"
            />
            Nửa trang
          </label>
        )}
        {showColumns && (
          <label className="flex items-center gap-1.5">
            Số cột
            <select
              aria-label={`Số cột khối ${label}`}
              value={resolveColumns(section)}
              onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 | 4 })}
              className={SMALL_SELECT}
            >
              {columnChoices.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {section.key !== 'topic_banner' && (
          <label className="flex items-center gap-1.5">
            Icon
            <select
              aria-label={`Icon tiêu đề khối ${label}`}
              value={section.icon ?? ''}
              onChange={(e) => onChange({ icon: e.target.value || null })}
              className={cn(SMALL_SELECT, 'max-w-36')}
            >
              <option value="">Không có</option>
              {Object.entries(MENU_ICONS)
                .filter(([key]) => key !== 'circle-dot')
                .map(([key, { label: iconLabel }]) => (
                  <option key={key} value={key}>
                    {iconLabel}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {info.newsVariants && (
        <div className="pl-6">
          <VariantPicker section={section} label={label} onChange={onChange} />
        </div>
      )}
      {section.key === 'shortcuts' && (
        <p className="pl-6 text-xs text-muted">
          Nội dung sửa ở{' '}
          <Link to="/admin/menu" className="text-primary hover:underline">
            Menu → Lối tắt trang chủ
          </Link>{' '}
          (icon hoặc logo, tên, liên kết). Ô Số mục là số ô hiện, tối đa {SHORTCUTS_MAX_ITEMS}.
        </p>
      )}
      {moduleOff && section.enabled && (
        <p className="pl-6 text-xs text-accent">
          Module {MODULE_LABELS[info.module!]} đang tắt nên khối này tạm không hiện.
        </p>
      )}
      {warning && <p className="pl-6 text-xs text-accent">{warning}</p>}
      {extra}
    </li>
  )
}

const LINK_OK = /^(\/|https?:\/\/)\S*$/

function BannerFields({
  banner,
  onChange,
}: {
  banner: HomepageBanner
  onChange: (patch: Partial<HomepageBanner>) => void
}) {
  return (
    <div className="space-y-3 pl-6">
      <ImageUploadField
        label="Ảnh banner"
        value={banner.image_path}
        onChange={(v) => onChange({ image_path: v })}
        folder="banners"
        hint="Có tiêu đề bên dưới: ảnh hiện mờ làm nền. Bỏ trống tiêu đề: hiện nguyên ảnh (dùng khi ảnh đã có chữ)."
      />
      <Field
        label="Liên kết khi bấm"
        placeholder="/chuyen-de/... hoặc https://..."
        value={banner.link_url}
        onChange={(e) => onChange({ link_url: e.target.value })}
      />
      <Field label="Tiêu đề" value={banner.title} onChange={(e) => onChange({ title: e.target.value })} />
      {banner.title.trim() ? (
        <>
          <Field
            label="Nhãn nhỏ"
            value={banner.badge}
            onChange={(e) => onChange({ badge: e.target.value })}
          />
          <Field
            label="Dòng mô tả"
            value={banner.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
          <Field
            label="Chữ trên nút"
            placeholder="Xem chuyên đề"
            value={banner.cta_label}
            onChange={(e) => onChange({ cta_label: e.target.value })}
          />
          <Field
            label="Màu nền"
            placeholder="#A80000"
            hint="Để trống sẽ dùng màu chính của trường."
            value={banner.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </>
      ) : (
        <Field
          label="Mô tả ảnh (cho người khiếm thị)"
          value={banner.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
        />
      )}
    </div>
  )
}

/** Nhóm phương án chọn một, có hình minh họa nhỏ. */
function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string
  value: T
  options: Array<{ value: T; label: string; sketch: React.ReactNode }>
  onChange: (next: T) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex w-36 cursor-pointer flex-col gap-1.5 rounded-lg border p-2 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
              value === o.value
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border text-muted hover:bg-bg',
            )}
          >
            <input
              type="radio"
              name={legend}
              aria-label={`${legend}: ${o.label}`}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.sketch}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const SKETCH_BOX = 'rounded-[2px] bg-current opacity-50'

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

  const setSections = (fn: (sections: HomepageSection[]) => HomepageSection[]) =>
    setDraft((d) => ({ ...d, sections: fn(d.sections) }))

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Chuyên mục'
  const labelOf = (section: HomepageSection) =>
    section.key === 'category_news'
      ? `Chuyên mục ${categoryName(section.category_id)}`
      : SECTION_INFO[section.key].label

  const categoryBlocks = draft.sections.filter((s) => s.key === 'category_news')
  const addableCategories = categories.filter(
    (c) => c.is_active && !categoryBlocks.some((s) => s.category_id === c.id),
  )
  const activeCategoryIds = categories.filter((c) => c.is_active).map((c) => c.id)

  const choosePreset = (key: LayoutPresetKey) => {
    const { label } = LAYOUT_PRESETS[key]
    const question = `Áp dụng mẫu "${label}"? Vùng, thứ tự và kiểu của các khối trong bản nháp sẽ bị thay. Chỉ có hiệu lực khi bấm Lưu bố cục.`
    if (!confirmAction(question)) return
    setDraft((d) => applyPreset(key, d, activeCategoryIds))
    setMessage(null)
  }
  const chooseDefault = () => {
    if (!confirmAction('Đưa bản nháp về bố cục mặc định? Chỉ có hiệu lực khi bấm Lưu bố cục.')) return
    setDraft((d) => applyDefaultLayout(d))
    setMessage(null)
  }
  const preview = () => {
    if (writePreviewDraft(draft)) window.open('/?xem-truoc=1', '_blank')
    else setMessage({ tone: 'danger', text: 'Trình duyệt chặn lưu tạm nên không xem trước được.' })
  }

  const save = async () => {
    const { link_url: link, color } = draft.banner
    if (link && !LINK_OK.test(link)) {
      setMessage({ tone: 'danger', text: 'Liên kết banner phải bắt đầu bằng / hoặc https://' })
      return
    }
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      setMessage({ tone: 'danger', text: 'Màu nền banner phải có dạng #A80000' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      // Số khởi điểm bộ đếm và kiểu trang danh sách tin sửa ở nơi khác: luôn lấy giá trị đang lưu
      await saveSetting('homepage', {
        ...draft,
        visit_counter_offset: homepage.visit_counter_offset,
        news_list: homepage.news_list,
      })
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
      setMessage({ tone: 'success', text: 'Đã lưu bố cục. Trang chủ đã cập nhật.' })
    } catch (err) {
      setMessage({ tone: 'danger', text: toVietnameseError(err) })
    } finally {
      setSaving(false)
    }
  }

  const zonePanel = (zone: HomepageZone) => {
    const list = draft.sections.filter((s) => s.zone === zone)
    return (
      <Panel key={zone} title={ZONE_LABELS[zone]}>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Chưa có khối nào. Đổi ô Vùng của một khối để đưa vào đây.</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {list.map((section, i) => {
              const inactive =
                section.key === 'category_news' &&
                categories.length > 0 &&
                !activeCategoryIds.includes(section.category_id ?? '')
              return (
                <SectionRow
                  key={section.id}
                  section={section}
                  label={labelOf(section)}
                  first={i === 0}
                  last={i === list.length - 1}
                  onChange={(patch) => setSections((all) => patchSection(all, section.id, patch))}
                  onMove={(delta) => setSections((all) => moveSection(all, section.id, delta))}
                  onZone={(next) => setSections((all) => moveToZone(all, section.id, next))}
                  onRemove={
                    section.key === 'category_news'
                      ? () => setSections((all) => all.filter((s) => s.id !== section.id))
                      : undefined
                  }
                  warning={inactive ? 'Chuyên mục này đã xóa hoặc đang ẩn nên khối không hiện.' : undefined}
                  extra={
                    <>
                      {section.key === 'topic_banner' && (
                        <BannerFields
                          banner={draft.banner}
                          onChange={(patch) => setDraft((d) => ({ ...d, banner: { ...d.banner, ...patch } }))}
                        />
                      )}
                      {section.key === 'announcements' && (
                        <div className="pl-6">
                          <CheckboxField
                            label="Làm nổi thông báo mới nhất (nền màu, nhãn Mới)"
                            checked={draft.highlight_latest_announcement}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, highlight_latest_announcement: e.target.checked }))
                            }
                          />
                        </div>
                      )}
                      {section.key === 'documents' && (
                        <div className="pl-6">
                          <CheckboxField
                            label="Danh sách văn bản chạy lên (nên đặt 5-7 mục)"
                            checked={draft.documents_ticker}
                            onChange={(e) => setDraft((d) => ({ ...d, documents_ticker: e.target.checked }))}
                          />
                        </div>
                      )}
                    </>
                  }
                />
              )
            })}
          </ul>
        )}
      </Panel>
    )
  }

  return (
    <div className="space-y-5">
      {message && <Alert tone={message.tone} title={message.text} />}
      <Panel title="Mẫu bố cục">
        <p className="text-sm text-muted">
          Chọn một mẫu rồi sửa tiếp từng khối. Tiêu đề, icon và nội dung banner được giữ lại.
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LAYOUT_PRESETS) as LayoutPresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className="w-full rounded-lg border border-border p-3 text-left hover:border-primary hover:bg-bg sm:w-56"
            >
              <span className="block font-semibold text-primary">{LAYOUT_PRESETS[key].label}</span>
              <span className="mt-1 block text-xs text-muted">{LAYOUT_PRESETS[key].description}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={chooseDefault}
            className="w-full rounded-lg border border-dashed border-border p-3 text-left hover:border-primary hover:bg-bg sm:w-56"
          >
            <span className="block font-semibold text-primary">Bố cục mặc định</span>
            <span className="mt-1 block text-xs text-muted">
              Slide toàn rộng, cột chính + cột phải, kiểu gốc
            </span>
          </button>
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Panel title="Đầu trang và hình thức">
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
          <div className="flex flex-wrap gap-6">
            <ChoiceGroup
              legend="Kiểu đầu trang"
              value={draft.hero}
              onChange={(hero) => setDraft((d) => ({ ...d, hero }))}
              options={[
                {
                  value: 'full',
                  label: 'Slide toàn rộng',
                  sketch: <span className={cn(SKETCH_BOX, 'block h-10')} />,
                },
                {
                  value: 'split',
                  label: 'Slide + cột Tiêu điểm',
                  sketch: (
                    <span className="grid h-10 grid-cols-[2fr_1fr] gap-1">
                      <span className={SKETCH_BOX} />
                      <span className={cn(SKETCH_BOX, 'opacity-25')} />
                    </span>
                  ),
                },
                {
                  value: 'portal',
                  label: 'Slide + dải tin + tab Xem nhiều',
                  sketch: (
                    <span className="grid h-10 grid-cols-[2fr_1fr] gap-1">
                      <span className="grid grid-rows-[2fr_1fr] gap-0.5">
                        <span className={SKETCH_BOX} />
                        <span className="grid grid-cols-4 gap-0.5">
                          <span className={SKETCH_BOX} />
                          <span className={SKETCH_BOX} />
                          <span className={SKETCH_BOX} />
                          <span className={SKETCH_BOX} />
                        </span>
                      </span>
                      <span className={cn(SKETCH_BOX, 'opacity-25')} />
                    </span>
                  ),
                },
              ]}
            />
            <ChoiceGroup
              legend="Tiêu đề khối"
              value={draft.heading_style}
              onChange={(heading_style) => setDraft((d) => ({ ...d, heading_style }))}
              options={[
                {
                  value: 'underline',
                  label: 'Gạch chân',
                  sketch: (
                    <span className="flex h-10 items-end">
                      <span className="block w-full border-b-2 border-current pb-1 text-[10px] uppercase">
                        Tin mới
                      </span>
                    </span>
                  ),
                },
                {
                  value: 'bar',
                  label: 'Thanh màu',
                  sketch: (
                    <span className="flex h-10 items-center">
                      <span className="block w-full rounded bg-primary px-1.5 py-1 text-[10px] uppercase text-white">
                        Tin mới
                      </span>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Sơ đồ bố cục (bản nháp)">
          <LayoutMap settings={draft} categoryName={categoryName} />
          <Button variant="ghost" onClick={preview}>
            <ExternalLink className="h-4 w-4" aria-hidden /> Xem trước với dữ liệu thật
          </Button>
        </Panel>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-5">
          {zonePanel('top')}
          {zonePanel('main')}
          {zonePanel('bottom')}
          <Panel title="Thêm khối chuyên mục">
            {categoryBlocks.length >= MAX_CATEGORY_BLOCKS ? (
              <p className="text-sm text-muted">Đã đủ {MAX_CATEGORY_BLOCKS} khối chuyên mục.</p>
            ) : addableCategories.length === 0 ? (
              <p className="text-sm text-muted">Mọi chuyên mục đang hoạt động đều đã có khối.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {addableCategories.map((c) => (
                  <Button
                    key={c.id}
                    variant="ghost"
                    onClick={() => setSections((all) => [...all, newCategorySection(c.id)])}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> {c.name}
                  </Button>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="min-w-0">{zonePanel('sidebar')}</div>
      </div>
      <p className="text-xs text-muted">
        Bỏ trống ô tiêu đề để dùng tên mặc định. Khối không có nội dung sẽ tự ẩn. Hai khối "Nửa trang" liền
        nhau xếp song song, trên điện thoại luôn một cột. Kiểu trang danh sách tin chọn ở{' '}
        <Link to="/admin/tin-tuc" className="text-primary hover:underline">
          Tin tức
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} loading={saving}>
          Lưu bố cục
        </Button>
        <Button variant="ghost" onClick={preview}>
          Xem trước
        </Button>
      </div>
    </div>
  )
}
