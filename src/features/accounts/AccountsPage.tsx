import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  CopyPlus,
  Copy,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Trash2,
  Unlock,
  UserPlus,
} from 'lucide-react'
import { AdminPageHeader, Panel, QueryState, TableCard } from '@/components/admin/AdminPage'
import { confirmAction } from '@/components/admin/confirm'
import { Alert } from '@/components/ui/Alert'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { SelectField } from '@/components/ui/FormControls'
import { ROLE_LABELS, useAuth, type Role } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  ACCOUNTS_KEY,
  changeRole,
  createInvitation,
  createStaffAccount,
  extendInvitation,
  fetchAccounts,
  fetchInvitations,
  invitationLink,
  invitationMailto,
  invitationState,
  INVITATIONS_KEY,
  resetStaffPassword,
  revokeInvitation,
  setAccountActive,
  type Account,
  type Invitation,
  type InvitationTarget,
  type InvitationState,
  type StaffCredentials,
} from './api'
import { CredentialsBox } from './StaffAccounts'

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

const roleLabel = (role: string | null) => ROLE_LABELS[role as Role] ?? 'Thành viên'

const inviteSchema = z.object({
  email: z.email('Email không hợp lệ'),
  role: z.custom<Role>((v) => typeof v === 'string' && v in ROLE_LABELS),
})
type InviteValues = z.infer<typeof inviteSchema>

const STATE_BADGES: Record<InvitationState, { tone: BadgeTone; label: string }> = {
  open: { tone: 'warning', label: 'Chờ đăng ký' },
  expired: { tone: 'danger', label: 'Hết hạn' },
  accepted: { tone: 'success', label: 'Đã nhận' },
}

function InviteLinkBox({ target }: { target: InvitationTarget }) {
  const { identity } = useSite()
  const [copied, setCopied] = useState(false)
  const link = invitationLink(target)

  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <Alert tone="success" title={`Liên kết mời cho ${target.email}`}>
      <p>
        Website không tự gửi thư. Hãy gửi riêng liên kết này cho đúng người được mời qua email hoặc Zalo; ai
        có liên kết đều tạo được tài khoản với vai trò đã chọn.
      </p>
      <input
        readOnly
        aria-label="Liên kết mời"
        value={link}
        onFocus={(e) => e.target.select()}
        className="mt-2 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
        </Button>
        <a href={invitationMailto(target, identity.school_name)} className={buttonClasses('outline', 'sm')}>
          <Mail className="h-4 w-4" aria-hidden /> Soạn thư
        </a>
      </div>
    </Alert>
  )
}

function InviteForm({ onInvited }: { onInvited: (target: InvitationTarget) => void }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'EDITOR' },
  })
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(async ({ email, role }) => {
    setError(null)
    try {
      const target = await createInvitation(email, role)
      await queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY })
      onInvited(target)
      form.reset()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {error && <Alert tone="danger" title={error} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem_auto] sm:items-start">
        <Field
          label="Email người được mời"
          type="email"
          error={e.email?.message}
          {...form.register('email')}
        />
        <SelectField label="Vai trò" options={ROLE_OPTIONS} {...form.register('role')} />
        <Button type="submit" className="sm:mt-[1.625rem]" loading={form.formState.isSubmitting}>
          <UserPlus className="h-4 w-4" aria-hidden /> Tạo lời mời
        </Button>
      </div>
    </form>
  )
}

const createSchema = z.object({
  full_name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  email: z.email('Email không hợp lệ'),
  role: z.custom<Role>((v) => typeof v === 'string' && v in ROLE_LABELS),
})
type CreateValues = z.infer<typeof createSchema>

/** Tạo tài khoản có sẵn mật khẩu ngẫu nhiên; nút Nhân bản điền sẵn nhóm của tài khoản được chọn. */
function CreateAccountForm({ role, onCreated }: { role: Role; onCreated: (item: StaffCredentials) => void }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: '', email: '', role },
  })
  const e = form.formState.errors
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      onCreated(await createStaffAccount(values.email, values.full_name, values.role))
      await queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      form.reset({ full_name: '', email: '', role: values.role })
    } catch (err) {
      setError(toVietnameseError(err))
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {error && <Alert tone="danger" title={error} />}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_14rem_auto] lg:items-start">
        <Field label="Họ tên" error={e.full_name?.message} {...form.register('full_name')} />
        <Field label="Email đăng nhập" type="email" error={e.email?.message} {...form.register('email')} />
        <SelectField label="Nhóm" options={ROLE_OPTIONS} {...form.register('role')} />
        <Button type="submit" className="lg:mt-[1.625rem]" loading={form.formState.isSubmitting}>
          <UserPlus className="h-4 w-4" aria-hidden /> Tạo tài khoản
        </Button>
      </div>
    </form>
  )
}

function InvitationsTable({ items, onError }: { items: Invitation[]; onError: (message: string) => void }) {
  const queryClient = useQueryClient()
  const [shownLink, setShownLink] = useState<InvitationTarget | null>(null)
  const action = useMutation({
    mutationFn: (run: () => Promise<void>) => run(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
    onError: (err) => onError(toVietnameseError(err)),
  })

  return (
    <>
      {shownLink && <InviteLinkBox key={shownLink.token} target={shownLink} />}
      <TableCard>
        <thead>
          <tr>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Người mời</th>
            <th>Hạn dùng</th>
            <th>Trạng thái</th>
            <th aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const state = invitationState(item)
            return (
              <tr key={item.id}>
                <td className="font-medium">{item.email}</td>
                <td className="whitespace-nowrap">{roleLabel(item.role)}</td>
                <td className="text-muted">{item.inviter?.full_name ?? '—'}</td>
                <td className="whitespace-nowrap text-muted">
                  {state === 'accepted' ? formatDate(item.accepted_at) : formatDate(item.expires_at)}
                </td>
                <td>
                  <Badge tone={STATE_BADGES[state].tone}>{STATE_BADGES[state].label}</Badge>
                </td>
                <td>
                  {state !== 'accepted' && (
                    <div className="flex justify-end gap-1.5 whitespace-nowrap">
                      {state === 'open' && (
                        <Button size="sm" variant="ghost" onClick={() => setShownLink(item)}>
                          <Copy className="h-4 w-4" aria-hidden /> Liên kết
                        </Button>
                      )}
                      {state === 'expired' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => action.mutate(() => extendInvitation(item.id))}
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden /> Gia hạn
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirmAction(`Thu hồi lời mời của ${item.email}?`))
                            action.mutate(() => revokeInvitation(item.id))
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden /> Thu hồi
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableCard>
    </>
  )
}

function AccountsTable({
  items,
  onError,
  onClone,
  onReset,
}: {
  items: Account[]
  onError: (message: string) => void
  onClone: (role: Role) => void
  onReset: (item: StaffCredentials) => void
}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const action = useMutation({
    mutationFn: (run: () => Promise<void>) => run(),
    onError: (err) => onError(toVietnameseError(err)),
    // Luôn tải lại: khi bị từ chối, ô chọn vai trò phải quay về giá trị thật
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })

  return (
    <TableCard>
      <thead>
        <tr>
          <th>Họ tên</th>
          <th>Vai trò</th>
          <th>Trạng thái</th>
          <th>Đăng nhập gần nhất</th>
          <th aria-label="Thao tác" />
        </tr>
      </thead>
      <tbody>
        {items.map((account) => {
          const isSelf = account.id === profile?.id
          return (
            <tr key={account.id}>
              <td>
                <span className="block font-semibold">
                  {account.full_name}
                  {isSelf && <span className="ml-1.5 font-normal text-muted">(bạn)</span>}
                </span>
                <span className="block text-xs text-muted">{account.email}</span>
              </td>
              <td>
                {isSelf ? (
                  roleLabel(account.role)
                ) : (
                  <select
                    aria-label={`Vai trò của ${account.full_name}`}
                    value={account.role ?? ''}
                    disabled={action.isPending}
                    onChange={(e) => {
                      // Đọc ngay: ô chọn có kiểm soát sẽ quay về giá trị cũ trước khi mutation chạy
                      const role = e.target.value as Role
                      action.mutate(() => changeRole(account.id, role))
                    }}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                  >
                    {account.role === null && <option value="">Thành viên</option>}
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                {account.is_active ? (
                  <Badge tone="success">Đang hoạt động</Badge>
                ) : (
                  <Badge tone="danger">Đã khóa</Badge>
                )}
              </td>
              <td className="whitespace-nowrap text-muted">
                {formatDateTime(account.last_sign_in_at) || 'Chưa đăng nhập'}
              </td>
              <td>
                {!isSelf && (
                  <div className="flex justify-end whitespace-nowrap">
                    {account.role && account.role !== 'SUPER_ADMIN' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Nhân bản ${account.full_name}`}
                          onClick={() => onClone(account.role as Role)}
                        >
                          <CopyPlus className="h-4 w-4" aria-hidden /> Nhân bản
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={action.isPending}
                          aria-label={`Cấp lại mật khẩu ${account.full_name}`}
                          onClick={() => {
                            if (
                              confirmAction(
                                `Cấp mật khẩu mới cho ${account.full_name}? Mật khẩu cũ hết tác dụng và người này bị đăng xuất.`,
                              )
                            )
                              action.mutate(async () => onReset(await resetStaffPassword(account.id)))
                          }}
                        >
                          <KeyRound className="h-4 w-4" aria-hidden /> Cấp lại mật khẩu
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={action.isPending}
                      onClick={() => {
                        const message = account.is_active
                          ? `Khóa tài khoản ${account.full_name}? Người này sẽ không dùng được trang quản trị nữa, các bài đã viết vẫn giữ nguyên.`
                          : `Mở khóa tài khoản ${account.full_name}?`
                        if (confirmAction(message))
                          action.mutate(() => setAccountActive(account.id, !account.is_active))
                      }}
                    >
                      {account.is_active ? (
                        <Lock className="h-4 w-4" aria-hidden />
                      ) : (
                        <Unlock className="h-4 w-4" aria-hidden />
                      )}
                      {account.is_active ? 'Khóa' : 'Mở khóa'}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </TableCard>
  )
}

export function AccountsPage() {
  const [invited, setInvited] = useState<InvitationTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<StaffCredentials[]>([])
  const [cloneRole, setCloneRole] = useState<{ role: Role; at: number }>({ role: 'GIAO_VIEN', at: 0 })
  const accounts = useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts })
  const invitations = useQuery({ queryKey: INVITATIONS_KEY, queryFn: fetchInvitations })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tài khoản"
        description="Tạo tài khoản trực tiếp hoặc gửi lời mời. Vai trò do Cơ sở dữ liệu kiểm tra ở mọi thao tác."
      />
      {error && <Alert tone="danger" title={error} />}

      <Panel title="Tạo tài khoản">
        <p className="text-sm text-muted">
          Mật khẩu ngẫu nhiên hiện một lần, người dùng phải đổi khi đăng nhập lần đầu. Muốn tạo người cùng
          nhóm với một tài khoản có sẵn, bấm Nhân bản ở danh sách dưới.
        </p>
        <CreateAccountForm
          key={cloneRole.at}
          role={cloneRole.role}
          onCreated={(item) => setCredentials((list) => [item, ...list])}
        />
        {credentials.length > 0 && (
          <CredentialsBox items={credentials} loginUrl={`${window.location.origin}/dang-nhap`} />
        )}
      </Panel>

      <Panel title="Mời thành viên">
        <InviteForm
          onInvited={(target) => {
            setError(null)
            setInvited(target)
          }}
        />
        {invited && <InviteLinkBox key={invited.token} target={invited} />}
      </Panel>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-primary">Thành viên</h2>
        <QueryState isPending={accounts.isPending} error={accounts.error} />
        {accounts.data && (
          <AccountsTable
            items={accounts.data}
            onError={setError}
            onClone={(role) => {
              setCloneRole({ role, at: Date.now() })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onReset={(item) => {
              setCredentials((list) => [item, ...list])
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-primary">Lời mời</h2>
        <QueryState isPending={invitations.isPending} error={invitations.error} />
        {invitations.data?.length === 0 && <EmptyState title="Chưa có lời mời nào" />}
        {invitations.data && invitations.data.length > 0 && (
          <InvitationsTable items={invitations.data} onError={setError} />
        )}
      </section>
    </div>
  )
}
