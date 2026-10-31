import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/features/auth/auth-context'
import { saveSetting } from '@/features/homepage/api'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'

const OPTIONS = [
  { value: 'list', label: 'Danh sách ảnh' },
  { value: 'grid', label: 'Lưới' },
] as const

/** Kiểu trang danh sách tin công khai. Lưu trong cấu hình trang chủ nên chỉ ai có homepage.manage mới thấy. */
export function NewsListStylePanel() {
  const { can } = useAuth()
  const { homepage } = useSite()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  if (!can('homepage.manage')) return null

  const choose = async (news_list: (typeof OPTIONS)[number]['value']) => {
    if (news_list === homepage.news_list) return
    setSaving(true)
    setError(null)
    try {
      await saveSetting('homepage', { ...homepage, news_list })
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <span id="news-list-style" className="font-medium">
        Kiểu trang Tin tức công khai
      </span>
      <div role="group" aria-labelledby="news-list-style" className="flex gap-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={saving}
            aria-pressed={homepage.news_list === o.value}
            onClick={() => void choose(o.value)}
            className={cn(
              'rounded-lg px-3 py-1 font-medium',
              homepage.news_list === o.value ? 'bg-primary text-white' : 'bg-bg hover:bg-border',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Link to="/admin/trang-chu?tab=bo-cuc" className="text-primary hover:underline">
        Bố cục trang chủ
      </Link>
      {error && <Alert tone="danger" title={error} />}
    </div>
  )
}
