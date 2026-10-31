import { createContext, use } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'

export type Role =
  'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'BAN_GIAM_HIEU' | 'TO_TRUONG' | 'DOAN_THE' | 'GIAO_VIEN' | 'NHAN_VIEN'

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Quản trị viên cấp cao',
  ADMIN: 'Quản trị nội dung',
  EDITOR: 'Biên tập viên',
  BAN_GIAM_HIEU: 'Ban giám hiệu',
  TO_TRUONG: 'Tổ trưởng chuyên môn',
  DOAN_THE: 'Đoàn thể',
  GIAO_VIEN: 'Giáo viên',
  NHAN_VIEN: 'Nhân viên',
}

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'avatar_url' | 'role' | 'is_active' | 'must_change_password'
>

export interface AuthContextValue {
  status: 'loading' | 'signed_out' | 'signed_in'
  session: Session | null
  profile: Profile | null
  /** Vai trò hiệu lực: null nếu chưa được cấp quyền hoặc bị khóa */
  role: Role | null
  can: (permission: string) => boolean
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return value
}
