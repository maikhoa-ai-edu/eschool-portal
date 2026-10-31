import type { Role } from '@/features/auth/auth-context'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const ACCOUNTS_KEY = ['accounts'] as const
export const INVITATIONS_KEY = ['invitations'] as const

const INVITATION_DAYS = 14

export interface Account {
  id: string
  email: string
  full_name: string
  role: string | null
  is_active: boolean
  created_at: string
  last_sign_in_at: string | null
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await getSupabase().rpc('list_accounts')
  if (error) throw error
  return data
}

/** RLS bỏ qua dòng không được phép mà không báo lỗi, nên phải kiểm tra có dòng nào được ghi không. */
async function updateProfile(id: string, patch: { role?: Role; is_active?: boolean }): Promise<void> {
  const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('permission denied')
}

export const changeRole = (id: string, role: Role) => updateProfile(id, { role })
export const setAccountActive = (id: string, isActive: boolean) => updateProfile(id, { is_active: isActive })

export interface Invitation {
  id: string
  email: string
  token: string
  role: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  inviter: { full_name: string } | null
}

export async function fetchInvitations(): Promise<Invitation[]> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .select(
      'id, email, token, role, created_at, expires_at, accepted_at, inviter:profiles!invitations_invited_by_fkey(full_name)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export type InvitationTarget = Pick<Invitation, 'email' | 'token'>

export async function createInvitation(email: string, role: Role): Promise<InvitationTarget> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .insert({ email: email.trim().toLowerCase(), role, invited_by: await requireUserId() })
    .select('email, token')
    .single()
  if (error?.code === '23505' && !error.message.includes('đã có tài khoản')) {
    throw new Error('Email này đang có lời mời chưa dùng. Hãy gia hạn hoặc thu hồi lời mời đó.')
  }
  if (error) throw error
  return data
}

/** Chính sách RLS yêu cầu invited_by là người đang thao tác, nên người gia hạn nhận lời mời về mình. */
export async function extendInvitation(id: string): Promise<void> {
  const expires = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await getSupabase()
    .from('invitations')
    .update({ expires_at: expires, invited_by: await requireUserId() })
    .eq('id', id)
  if (error) throw error
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await getSupabase().from('invitations').delete().eq('id', id)
  if (error) throw error
}

export type InvitationState = 'open' | 'expired' | 'accepted'

export function invitationState(
  item: Pick<Invitation, 'accepted_at' | 'expires_at'>,
  now = new Date(),
): InvitationState {
  if (item.accepted_at) return 'accepted'
  return new Date(item.expires_at) > now ? 'open' : 'expired'
}

export function invitationLink({ email, token }: InvitationTarget, origin = window.location.origin): string {
  return `${origin}/dang-ky?email=${encodeURIComponent(email)}&ma=${token}`
}

/** Website tĩnh không tự gửi được thư, nên soạn sẵn thư trong ứng dụng email của người mời. */
export function invitationMailto(
  target: InvitationTarget,
  schoolName: string,
  origin = window.location.origin,
): string {
  const subject = `Lời mời tham gia quản trị website ${schoolName}`
  const body = [
    'Kính gửi thầy/cô,',
    '',
    `Nhà trường mời thầy/cô tham gia quản trị website ${schoolName}. Vui lòng mở liên kết dưới đây để tạo tài khoản (liên kết dành riêng cho thầy/cô, xin không chuyển cho người khác):`,
    '',
    invitationLink(target, origin),
    '',
    `Lời mời có hiệu lực trong ${INVITATION_DAYS} ngày.`,
  ].join('\n')
  return `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export interface StaffCredentials {
  id: string
  email: string
  full_name: string
  role: string
  password: string
}

/** Các nhóm tạo sẵn ở trình cài đặt. */
export const DEFAULT_STAFF_GROUPS: Array<{ role: Role; name: string }> = [
  { role: 'BAN_GIAM_HIEU', name: 'Ban giám hiệu' },
  { role: 'TO_TRUONG', name: 'Tổ trưởng chuyên môn' },
  { role: 'DOAN_THE', name: 'Đoàn thể' },
  { role: 'GIAO_VIEN', name: 'Giáo viên' },
  { role: 'NHAN_VIEN', name: 'Nhân viên' },
]

export async function createStaffAccount(
  email: string,
  fullName: string,
  role: Role,
): Promise<StaffCredentials> {
  const { data, error } = await getSupabase().rpc('create_staff_account', {
    p_email: email,
    p_full_name: fullName,
    p_role: role,
  })
  if (error) throw error
  return data as unknown as StaffCredentials
}

export async function resetStaffPassword(id: string): Promise<StaffCredentials> {
  const { data, error } = await getSupabase().rpc('reset_staff_password', { p_user_id: id })
  if (error) throw error
  return data as unknown as StaffCredentials
}
