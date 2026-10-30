import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { confirmAction } from '@/components/admin/confirm'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { RichEditor } from '@/components/editor/RichEditor'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SelectField, TextareaField } from '@/components/ui/FormControls'
import { fetchTagsWithUsage, NEWS_KEY } from '@/features/news/api'
import { cn } from '@/lib/cn'
import { fetchAlbumOptions, fetchDocumentOptions, TOPICS_KEY } from '../api'
import {
  newTopicSection,
  TOPIC_SECTION_LABELS,
  TOPIC_SECTION_TYPES,
  type TopicSection,
  type TopicSectionType,
} from '../sections'

type Change = (patch: Partial<TopicSection>) => void
type SectionOf<T extends TopicSection['type']> = Extract<TopicSection, { type: T }>

function CardsFields({ section, onChange }: { section: SectionOf<'cards'>; onChange: Change }) {
  const setItems = (items: typeof section.items) => onChange({ items } as Partial<TopicSection>)
  const patch = (index: number, value: Partial<(typeof section.items)[number]>) =>
    setItems(section.items.map((c, i) => (i === index ? { ...c, ...value } : c)))
  return (
    <div className="space-y-3">
      {section.items.map((card, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border p-3">
          <ImageUploadField
            label={`Ảnh thẻ ${index + 1}`}
            value={card.image_path}
            onChange={(v) => patch(index, { image_path: v })}
            folder="topics"
          />
          <Field
            label="Tiêu đề thẻ"
            value={card.title}
            onChange={(e) => patch(index, { title: e.target.value })}
          />
          <TextareaField
            label="Mô tả"
            rows={2}
            value={card.text}
            onChange={(e) => patch(index, { text: e.target.value })}
          />
          <Field
            label="Liên kết (không bắt buộc)"
            placeholder="/tin-tuc/... hoặc https://..."
            value={card.url ?? ''}
            onChange={(e) => patch(index, { url: e.target.value || null })}
          />
          <Button variant="ghost" onClick={() => setItems(section.items.filter((_, i) => i !== index))}>
            <Trash2 className="h-4 w-4 text-danger" aria-hidden /> Xóa thẻ
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() => setItems([...section.items, { image_path: null, title: '', text: '', url: null }])}
      >
        <Plus className="h-4 w-4" aria-hidden /> Thêm thẻ
      </Button>
    </div>
  )
}

function NewsFields({ section, onChange }: { section: SectionOf<'news'>; onChange: Change }) {
  const { data: tags = [] } = useQuery({
    queryKey: [...NEWS_KEY, 'tags', 'usage'],
    queryFn: fetchTagsWithUsage,
  })
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
      <SelectField
        label="Lấy tin có thẻ"
        hint="Gắn thẻ này khi soạn bài ở mục Tin tức, bài đã đăng sẽ tự hiện ở đây."
        placeholder="— Chọn thẻ —"
        options={tags.map((t) => ({ value: t.slug, label: `${t.name} (${t.usage} bài)` }))}
        value={section.tag_slug}
        onChange={(e) => onChange({ tag_slug: e.target.value } as Partial<TopicSection>)}
      />
      <Field
        label="Số bài"
        type="number"
        min={1}
        max={12}
        value={section.limit}
        onChange={(e) =>
          onChange({ limit: Math.min(12, Math.max(1, Number(e.target.value) || 1)) } as Partial<TopicSection>)
        }
      />
    </div>
  )
}

function DocumentsFields({ section, onChange }: { section: SectionOf<'documents'>; onChange: Change }) {
  const { data: docs = [] } = useQuery({
    queryKey: [...TOPICS_KEY, 'document-options'],
    queryFn: fetchDocumentOptions,
  })
  const toggle = (id: string, on: boolean) =>
    onChange({
      document_ids: on ? [...section.document_ids, id] : section.document_ids.filter((d) => d !== id),
    } as Partial<TopicSection>)
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">Chọn văn bản đã ban hành</legend>
      {docs.length === 0 && <p className="text-sm text-muted">Chưa có văn bản nào. Thêm ở mục Văn bản.</p>}
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
        {docs.map((d) => (
          <label key={d.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={section.document_ids.includes(d.id)}
              onChange={(e) => toggle(d.id, e.target.checked)}
              className="mt-1 accent-[var(--brand-primary)]"
            />
            {d.title}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function AlbumFields({ section, onChange }: { section: SectionOf<'album'>; onChange: Change }) {
  const { data: albums = [] } = useQuery({
    queryKey: [...TOPICS_KEY, 'album-options'],
    queryFn: fetchAlbumOptions,
  })
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
      <SelectField
        label="Album"
        placeholder="— Chọn album —"
        options={albums.map((a) => ({ value: a.slug, label: a.title }))}
        value={section.album_slug}
        onChange={(e) => onChange({ album_slug: e.target.value } as Partial<TopicSection>)}
      />
      <Field
        label="Số ảnh"
        type="number"
        min={1}
        max={24}
        value={section.limit}
        onChange={(e) =>
          onChange({ limit: Math.min(24, Math.max(1, Number(e.target.value) || 1)) } as Partial<TopicSection>)
        }
      />
    </div>
  )
}

function SectionFields({ section, onChange }: { section: TopicSection; onChange: Change }) {
  const set = (patch: Record<string, unknown>) => onChange(patch as Partial<TopicSection>)
  switch (section.type) {
    case 'rich_text':
      return (
        <RichEditor
          label="Nội dung khối"
          initialValue={section.html}
          onChange={(html) => set({ html })}
          uploadFolder="topics"
        />
      )
    case 'quote':
      return (
        <>
          <TextareaField
            label="Lời trích"
            rows={3}
            value={section.text}
            onChange={(e) => set({ text: e.target.value })}
          />
          <Field
            label="Người nói / nguồn"
            value={section.author}
            onChange={(e) => set({ author: e.target.value })}
          />
        </>
      )
    case 'list':
      return (
        <TextareaField
          label="Các mục (mỗi dòng một mục)"
          rows={5}
          value={section.items.join('\n')}
          onChange={(e) => set({ items: e.target.value.split('\n') })}
        />
      )
    case 'cards':
      return <CardsFields section={section} onChange={onChange} />
    case 'news':
      return <NewsFields section={section} onChange={onChange} />
    case 'documents':
      return <DocumentsFields section={section} onChange={onChange} />
    case 'album':
      return <AlbumFields section={section} onChange={onChange} />
    case 'video':
      return (
        <>
          <Field
            label="Liên kết YouTube"
            placeholder="https://www.youtube.com/watch?v=..."
            value={section.url}
            onChange={(e) => set({ url: e.target.value })}
          />
          <Field
            label="Chú thích"
            value={section.caption}
            onChange={(e) => set({ caption: e.target.value })}
          />
        </>
      )
  }
}

export function SectionsEditor({
  sections,
  onChange,
}: {
  sections: TopicSection[]
  onChange: (next: TopicSection[]) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [newType, setNewType] = useState<TopicSectionType>('rich_text')
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg disabled:opacity-30'

  const patch = (id: string, value: Partial<TopicSection>) =>
    onChange(sections.map((s) => (s.id === id ? ({ ...s, ...value } as TopicSection) : s)))
  const move = (index: number, delta: -1 | 1) => {
    const next = [...sections]
    ;[next[index], next[index + delta]] = [next[index + delta]!, next[index]!]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {sections.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-border">
          {sections.map((section, index) => {
            const open = openId === section.id
            const name = section.title || TOPIC_SECTION_LABELS[section.type]
            return (
              <li
                key={section.id}
                className={cn('border-b border-border last:border-0', !section.enabled && 'bg-bg/60')}
              >
                <div className="flex flex-wrap items-center gap-2 p-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : section.id)}
                    className="flex min-w-40 flex-1 items-center gap-1.5 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{name}</span>
                      <span className="block text-xs text-muted">
                        {TOPIC_SECTION_LABELS[section.type]} ·{' '}
                        {section.area === 'side' ? 'Cột phải' : 'Cột chính'}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className={icon}
                      disabled={index === 0}
                      aria-label={`Chuyển "${name}" lên`}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={icon}
                      disabled={index === sections.length - 1}
                      aria-label={`Chuyển "${name}" xuống`}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <label className="mx-1 flex items-center gap-1 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        aria-label={`Hiển thị "${name}"`}
                        onChange={(e) => patch(section.id, { enabled: e.target.checked })}
                        className="accent-[var(--brand-primary)]"
                      />
                      Hiện
                    </label>
                    <button
                      type="button"
                      className={cn(icon, 'text-danger')}
                      aria-label={`Xóa "${name}"`}
                      onClick={() => {
                        if (confirmAction(`Xóa khối "${name}"?`))
                          onChange(sections.filter((s) => s.id !== section.id))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="space-y-3 border-t border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                      <Field
                        label="Tiêu đề khối (không bắt buộc)"
                        value={section.title}
                        onChange={(e) => patch(section.id, { title: e.target.value })}
                      />
                      <SelectField
                        label="Vị trí"
                        options={[
                          { value: 'main', label: 'Cột chính' },
                          { value: 'side', label: 'Cột phải' },
                        ]}
                        value={section.area}
                        onChange={(e) =>
                          patch(section.id, { area: e.target.value === 'side' ? 'side' : 'main' })
                        }
                      />
                    </div>
                    <SectionFields section={section} onChange={(value) => patch(section.id, value)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <SelectField
            label="Loại khối mới"
            options={TOPIC_SECTION_TYPES.map((t) => ({ value: t, label: TOPIC_SECTION_LABELS[t] }))}
            value={newType}
            onChange={(e) => setNewType(e.target.value as TopicSectionType)}
          />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            const section = newTopicSection(newType)
            onChange([...sections, section])
            setOpenId(section.id)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm khối
        </Button>
      </div>
    </div>
  )
}
