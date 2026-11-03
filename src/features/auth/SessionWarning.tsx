import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ExpiryReason } from './session-limits'

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes} phút ${String(seconds).padStart(2, '0')} giây` : `${seconds} giây`
}

/** Báo sắp tự đăng xuất; đếm ngược theo giây. */
export function SessionWarning({
  reason,
  at,
  onContinue,
  onSignOut,
}: {
  reason: ExpiryReason
  at: number
  onContinue: () => void
  onSignOut: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const remaining = formatRemaining(at - now)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-text"
        className="w-full max-w-sm rounded-xl bg-surface p-5 text-text shadow-xl"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent" aria-hidden />
          <h2 id="session-warning-title" className="font-bold text-primary">
            {reason === 'idle' ? 'Bạn vẫn đang làm việc chứ?' : 'Phiên đăng nhập sắp hết hạn'}
          </h2>
        </div>
        <p id="session-warning-text" className="mt-2 text-sm text-muted">
          {reason === 'idle'
            ? `Không thấy thao tác trong thời gian dài. Hệ thống sẽ tự đăng xuất sau ${remaining}.`
            : `Phiên đăng nhập sẽ hết hạn sau ${remaining}. Hãy lưu bài đang soạn, sau đó đăng nhập lại.`}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onSignOut}>
            Đăng xuất
          </Button>
          <Button size="sm" autoFocus onClick={onContinue}>
            {reason === 'idle' ? 'Tiếp tục làm việc' : 'Đã hiểu'}
          </Button>
        </div>
      </div>
    </div>
  )
}
