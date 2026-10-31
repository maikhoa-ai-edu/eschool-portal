import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ROLE_LABELS, type Role } from '@/features/auth/auth-context'
import type { StaffCredentials } from './api'

/** Mật khẩu chỉ có trong bộ nhớ của trang này: rời trang là mất, chỉ có thể cấp lại. */
export function CredentialsBox({ items, loginUrl }: { items: StaffCredentials[]; loginUrl: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const text = items
      .map(
        (i) =>
          `${i.full_name} (${ROLE_LABELS[i.role as Role] ?? i.role})\nEmail: ${i.email}\nMật khẩu: ${i.password}`,
      )
      .join('\n\n')
    await navigator.clipboard.writeText(`Đăng nhập tại: ${loginUrl}\n\n${text}`)
    setCopied(true)
  }
  return (
    <Alert tone="warning" title="Lưu lại mật khẩu ngay: chỉ hiện một lần">
      <p>Gửi riêng cho từng người. Người dùng sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg border border-border bg-surface p-2 text-sm text-text">
            <p className="font-semibold">
              {i.full_name} · {ROLE_LABELS[i.role as Role] ?? i.role}
            </p>
            <p className="break-all text-xs">{i.email}</p>
            <code className="break-all text-sm" aria-label={`Mật khẩu của ${i.email}`}>
              {i.password}
            </code>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => void copy()}>
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? 'Đã sao chép' : 'Sao chép tất cả'}
      </Button>
    </Alert>
  )
}
