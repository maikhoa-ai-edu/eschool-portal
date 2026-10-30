import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Panel } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { fetchVisitStats, VISIT_STATS_KEY } from '@/features/site/visits'
import { toVietnameseError } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { saveSetting } from '../api'

/** Bộ đếm truy cập: số liệu thật + số khởi điểm (giữ tổng lượt của website cũ khi chuyển sang). */
export function CounterTab() {
  const { homepage } = useSite()
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: VISIT_STATS_KEY, queryFn: fetchVisitStats })
  const [offset, setOffset] = useState(String(homepage.visit_counter_offset))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const parsed = Number(offset)
  const valid = Number.isInteger(parsed) && parsed >= 0

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSetting('homepage', { ...homepage, visit_counter_offset: parsed })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VISIT_STATS_KEY }),
      ])
      setMessage({ tone: 'success', text: 'Đã lưu số khởi điểm.' })
    } catch (err) {
      setMessage({ tone: 'danger', text: toVietnameseError(err) })
    } finally {
      setSaving(false)
    }
  }

  const stats: Array<[string, number | undefined]> = [
    ['Hôm nay', data?.today],
    ['Hôm qua', data?.yesterday],
    ['Tháng này', data?.month],
    ['Tổng (đã cộng số khởi điểm)', data?.total],
  ]

  return (
    <div className="max-w-3xl space-y-5">
      {message && <Alert tone={message.tone} title={message.text} />}
      <Panel title="Số liệu thật">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-bg p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-xl font-bold text-primary">
                {value === undefined ? '…' : formatNumber(value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          Mỗi trình duyệt được tính một lượt trong một phiên truy cập. Bật/tắt khối "Thống kê truy cập" ở tab
          Bố cục.
        </p>
      </Panel>
      <Panel title="Số khởi điểm">
        <Field
          label="Cộng thêm vào tổng lượt truy cập"
          type="number"
          min={0}
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          error={valid ? undefined : 'Nhập số nguyên không âm'}
          hint="Dùng khi chuyển từ website cũ sang: nhập tổng lượt truy cập của website cũ để không mất số liệu."
        />
        <Button onClick={() => void save()} loading={saving} disabled={!valid}>
          Lưu số khởi điểm
        </Button>
      </Panel>
    </div>
  )
}
