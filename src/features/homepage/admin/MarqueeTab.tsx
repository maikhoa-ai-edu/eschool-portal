import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/FormControls'
import { MENU_URL_PATTERN } from '@/features/menus/api'
import { MENU_ICONS } from '@/features/site/menu-icons'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { saveSetting } from '../api'

interface Row {
  id: number
  text: string
  url: string
}

let nextId = 0

export function MarqueeTab() {
  const { marquee } = useSite()
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(marquee.enabled)
  const [withNews, setWithNews] = useState(marquee.include_latest_news)
  const [rows, setRows] = useState<Row[]>(() =>
    marquee.items.map((i) => ({ id: nextId++, text: i.text, url: i.url ?? '' })),
  )
  const [label, setLabel] = useState(marquee.label)
  const [icon, setIcon] = useState(marquee.icon)
  const [bgColor, setBgColor] = useState(marquee.bg_color)
  const [speed, setSpeed] = useState<25 | 40 | 60>(marquee.speed)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const badColor = bgColor.trim() !== '' && !/^#[0-9a-fA-F]{6}$/.test(bgColor.trim())
  const badUrl = rows.some((r) => r.url.trim() !== '' && !MENU_URL_PATTERN.test(r.url.trim()))
  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const move = (index: number, delta: -1 | 1) =>
    setRows((list) => {
      const next = [...list]
      ;[next[index], next[index + delta]] = [next[index + delta]!, next[index]!]
      return next
    })

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSetting('marquee', {
        enabled,
        label: label.trim(),
        icon,
        bg_color: bgColor.trim(),
        speed,
        include_latest_news: withNews,
        items: rows
          .filter((r) => r.text.trim())
          .map((r) => ({ text: r.text.trim(), url: r.url.trim() || null })),
      })
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
      setMessage({ tone: 'success', text: 'Đã lưu dòng chữ chạy.' })
    } catch (err) {
      setMessage({ tone: 'danger', text: toVietnameseError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      {message && <Alert tone={message.tone} title={message.text} />}
      <Panel title="Dòng chữ chạy dưới menu">
        <CheckboxField
          label="Hiện dòng chữ chạy"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <CheckboxField
          label="Tự thêm 5 tin mới nhất"
          hint="Tiêu đề tin mới đăng tự chạy theo, không cần nhập tay."
          checked={withNews}
          onChange={(e) => setWithNews(e.target.checked)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Nhãn đầu dòng
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              placeholder="Tin nổi bật, Chủ đề năm học, Chủ điểm tháng..."
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Icon nhãn
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm font-normal"
            >
              <option value="">Tia sét</option>
              {Object.entries(MENU_ICONS)
                .filter(([key]) => key !== 'circle-dot')
                .map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Màu nền
            <span className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Chọn màu nền"
                value={badColor || !bgColor.trim() ? '#FFFFFF' : bgColor.trim()}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-9 w-12 rounded-lg border border-border bg-surface p-1"
              />
              <input
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                placeholder="Để trống: nền trắng"
                aria-label="Mã màu nền"
                aria-invalid={badColor}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm font-normal aria-[invalid=true]:border-danger"
              />
            </span>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Tốc độ chạy
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as 25 | 40 | 60)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm font-normal"
            >
              <option value={60}>Chậm</option>
              <option value={40}>Vừa</option>
              <option value={25}>Nhanh</option>
            </select>
          </label>
        </div>
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <input
                value={row.text}
                onChange={(e) => setRow(row.id, { text: e.target.value })}
                placeholder="Nội dung"
                aria-label={`Nội dung dòng ${index + 1}`}
                maxLength={200}
                className="h-9 min-w-0 flex-[2] rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <input
                value={row.url}
                onChange={(e) => setRow(row.id, { url: e.target.value })}
                placeholder="Liên kết (không bắt buộc)"
                aria-label={`Liên kết dòng ${index + 1}`}
                aria-invalid={row.url.trim() !== '' && !MENU_URL_PATTERN.test(row.url.trim())}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm aria-[invalid=true]:border-danger"
              />
              <div className="flex">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Lên"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Xuống"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Xóa dòng ${index + 1}`}
                  onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {badUrl && (
          <p className="text-xs text-danger">
            Liên kết bắt đầu bằng / (trong website) hoặc https:// (website khác).
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRows((list) => [...list, { id: nextId++, text: '', url: '' }])}
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm dòng
        </Button>
      </Panel>
      <Button onClick={() => void save()} loading={saving} disabled={badUrl || badColor}>
        Lưu dòng chữ chạy
      </Button>
    </div>
  )
}
