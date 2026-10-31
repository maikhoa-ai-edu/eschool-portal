import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import {
  ACCOUNTS_KEY,
  createStaffAccount,
  DEFAULT_STAFF_GROUPS,
  type StaffCredentials,
} from '@/features/accounts/api'
import { CredentialsBox } from '@/features/accounts/StaffAccounts'
import { ROLE_LABELS } from '@/features/auth/auth-context'
import { toVietnameseError } from '@/lib/errors'
import { StepCard } from './ui'

/** Bước tạo sẵn tài khoản các nhóm trong trường; dòng bỏ trống email thì tạo sau ở trang Tài khoản. */
export function DefaultAccountsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState(() => DEFAULT_STAFF_GROUPS.map((g) => ({ ...g, email: '', done: false })))
  const [created, setCreated] = useState<StaffCredentials[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const setRow = (role: string, patch: Partial<(typeof rows)[number]>) =>
    setRows((list) => list.map((r) => (r.role === role ? { ...r, ...patch } : r)))
  const pending = rows.filter((r) => !r.done && r.email.trim())

  const create = async () => {
    setBusy(true)
    const problems: string[] = []
    const made: StaffCredentials[] = []
    for (const row of pending) {
      if (!z.email().safeParse(row.email.trim()).success) {
        problems.push(`${row.email}: email không hợp lệ`)
        continue
      }
      try {
        made.push(await createStaffAccount(row.email, row.name, row.role))
        setRow(row.role, { done: true })
      } catch (err) {
        problems.push(`${row.email}: ${toVietnameseError(err)}`)
      }
    }
    setCreated((list) => [...list, ...made])
    setErrors(problems)
    setBusy(false)
    await queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
  }

  return (
    <StepCard
      title="Tài khoản các nhóm trong trường"
      description="Mỗi tài khoản được cấp mật khẩu ngẫu nhiên riêng và phải đổi ở lần đăng nhập đầu. Nhập email của người phụ trách; để trống thì tạo sau ở trang Tài khoản."
      actions={
        <>
          <Button variant="ghost" onClick={onBack}>
            ← Quay lại
          </Button>
          <Button onClick={onNext} variant={pending.length > 0 ? 'ghost' : 'primary'}>
            {created.length > 0 ? 'Đã lưu mật khẩu, tiếp tục' : 'Bỏ qua, tiếp tục'}
          </Button>
        </>
      }
    >
      {errors.length > 0 && (
        <Alert tone="danger" title="Một số tài khoản chưa tạo được">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      {created.length > 0 && (
        <CredentialsBox items={created} loginUrl={`${window.location.origin}/dang-nhap`} />
      )}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.role} className="grid items-center gap-2 sm:grid-cols-[10rem_1fr_1fr]">
            <span className="text-sm font-semibold">{ROLE_LABELS[row.role]}</span>
            <input
              value={row.name}
              disabled={row.done}
              aria-label={`Tên hiển thị ${ROLE_LABELS[row.role]}`}
              onChange={(e) => setRow(row.role, { name: e.target.value })}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm disabled:bg-bg"
            />
            <input
              type="email"
              value={row.email}
              disabled={row.done}
              placeholder="Email đăng nhập"
              aria-label={`Email ${ROLE_LABELS[row.role]}`}
              onChange={(e) => setRow(row.role, { email: e.target.value })}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm disabled:bg-bg"
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Nên dùng hộp thư có thật: thư đặt lại mật khẩu gửi về đây. Nếu quên, quản trị viên cấp cao vẫn cấp lại
        được mật khẩu mới.
      </p>
      <Button
        variant="outline"
        loading={busy}
        disabled={pending.length === 0 || pending.some((r) => !r.name.trim())}
        onClick={() => void create()}
      >
        Tạo {pending.length > 0 ? pending.length : ''} tài khoản
      </Button>
    </StepCard>
  )
}
