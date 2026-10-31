import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/FormControls'
import { MENU_ICONS } from '@/features/site/menu-icons'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { saveSetting } from '../api'

interface Row {
  id: number
  icon: string
  text: string
  url: string
}

const URL_OK = /^(\/|https?:\/\/|tel:|mailto:)\S*$/
let nextId = 0

export function ChromeTab() {
  const { chrome } = useSite()
  const queryClient = useQueryClient()
  const [headerSocial, setHeaderSocial] = useState(chrome.header_social)
  const [navSearch, setNavSearch] = useState(chrome.nav_search)
  const [linkIcons, setLinkIcons] = useState(chrome.footer_link_icons)
  const [connectIcons, setConnectIcons] = useState(chrome.footer_connect_icons)
  const [rows, setRows] = useState<Row[]>(() =>
    chrome.footer_info_lines.map((l) => ({ id: nextId++, icon: l.icon, text: l.text, url: l.url ?? '' })),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const badUrl = rows.some((r) => r.url.trim() !== '' && !URL_OK.test(r.url.trim()))
  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSetting('site_chrome', {
        header_social: headerSocial,
        nav_search: navSearch,
        footer_link_icons: linkIcons,
        footer_connect_icons: connectIcons,
        footer_info_lines: rows
          .filter((r) => r.text.trim())
          .map((r) => ({ icon: r.icon, text: r.text.trim(), url: r.url.trim() || null })),
      })
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
      setMessage({ tone: 'success', text: 'Đã lưu đầu trang và chân trang.' })
    } catch (err) {
      setMessage({ tone: 'danger', text: toVietnameseError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      {message && <Alert tone={message.tone} title={message.text} />}
      <Panel title="Đầu trang">
        <CheckboxField
          label="Hiện icon mạng xã hội ở thanh trên cùng"
          checked={headerSocial}
          onChange={(e) => setHeaderSocial(e.target.checked)}
        />
        <CheckboxField
          label="Hiện kính lúp tìm kiếm trên menu ngang"
          checked={navSearch}
          onChange={(e) => setNavSearch(e.target.checked)}
        />
        <p className="text-xs text-muted">
          Link Facebook, Zalo, YouTube, TikTok, điện thoại và email sửa ở{' '}
          <Link to="/admin/cai-dat" className="text-primary hover:underline">
            Thông tin trường
          </Link>
          ; kênh để trống thì không hiện.
        </p>
      </Panel>
      <Panel title="Chân trang">
        <CheckboxField
          label="Hiện icon trước các liên kết nhanh"
          checked={linkIcons}
          onChange={(e) => setLinkIcons(e.target.checked)}
        />
        <CheckboxField
          label="Mục Kết nối dùng icon (điện thoại, email, mạng xã hội)"
          checked={connectIcons}
          onChange={(e) => setConnectIcons(e.target.checked)}
        />
        <p className="text-xs text-muted">
          Thêm, bật/tắt từng liên kết nhanh (trang, module hoặc link ngoài) và chọn icon ở{' '}
          <Link to="/admin/menu" className="text-primary hover:underline">
            Menu → Chân trang
          </Link>
          .
        </p>
        <h3 className="pt-2 text-sm font-semibold">Dòng thông tin thêm ở mục thông tin trường</h3>
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <select
                value={row.icon}
                aria-label={`Icon dòng ${index + 1}`}
                onChange={(e) => setRow(row.id, { icon: e.target.value })}
                className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
              >
                {Object.entries(MENU_ICONS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={row.text}
                onChange={(e) => setRow(row.id, { text: e.target.value })}
                placeholder="Ví dụ: Hotline tuyển sinh: 0123 456 789"
                aria-label={`Nội dung dòng ${index + 1}`}
                maxLength={200}
                className="h-9 min-w-0 flex-[2] rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <input
                value={row.url}
                onChange={(e) => setRow(row.id, { url: e.target.value })}
                placeholder="Liên kết (không bắt buộc)"
                aria-label={`Liên kết dòng ${index + 1}`}
                aria-invalid={row.url.trim() !== '' && !URL_OK.test(row.url.trim())}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm aria-[invalid=true]:border-danger"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Xóa dòng ${index + 1}`}
                onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </li>
          ))}
        </ul>
        {badUrl && (
          <p className="text-xs text-danger">Liên kết bắt đầu bằng /, https://, tel: hoặc mailto:.</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRows((list) => [...list, { id: nextId++, icon: 'info', text: '', url: '' }])}
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm dòng
        </Button>
      </Panel>
      <Button onClick={() => void save()} loading={saving} disabled={badUrl}>
        Lưu đầu và chân trang
      </Button>
    </div>
  )
}
