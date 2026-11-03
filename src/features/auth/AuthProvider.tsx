import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useSite } from '@/features/site/site-context'
import { getSupabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue, type Profile, type Role } from './auth-context'
import {
  checkSession,
  EXPIRED_KEY,
  loginTimeFromToken,
  readLastActivity,
  sessionLimits,
  writeLastActivity,
  type ExpiryReason,
  type SessionCheck,
} from './session-limits'
import { SessionWarning } from './SessionWarning'

const CHECK_INTERVAL_MS = 15_000
/** Ghi dấu thao tác tối đa một lần trong khoảng này */
const ACTIVITY_THROTTLE_MS = 10_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_active, must_change_password')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function fetchPermissions(role: Role): Promise<string[]> {
  const { data, error } = await getSupabase().from('role_permissions').select('permission').eq('role', role)
  if (error) throw error
  return data.map((r) => r.permission)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { authOptions } = useSite()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [warning, setWarning] = useState<SessionCheck['warning']>(null)

  // Đọc trong callback của Supabase (đăng ký một lần) nên giữ trong ref
  const limitsRef = useRef(sessionLimits(authOptions.session_idle_minutes, authOptions.session_max_hours))
  useEffect(() => {
    limitsRef.current = sessionLimits(authOptions.session_idle_minutes, authOptions.session_max_hours)
  }, [authOptions.session_idle_minutes, authOptions.session_max_hours])
  // Dự phòng khi trình duyệt chặn localStorage
  const activityRef = useRef(0)
  const dismissedRef = useRef(0)

  const evaluate = useCallback((s: Session): SessionCheck => {
    const loginAt =
      loginTimeFromToken(s.access_token) ??
      (s.user.last_sign_in_at ? Date.parse(s.user.last_sign_in_at) : Date.now())
    const lastActivity = Math.max(readLastActivity() ?? 0, activityRef.current) || null
    return checkSession({ loginAt, lastActivity, now: Date.now() }, limitsRef.current)
  }, [])

  const expire = useCallback(
    (reason: ExpiryReason) => {
      try {
        sessionStorage.setItem(EXPIRED_KEY, reason)
      } catch {
        // Không báo được lý do ở trang đăng nhập, vẫn đăng xuất
      }
      setSession(null)
      setWarning(null)
      // Chỉ đăng xuất trên máy này; máy khác của cùng người dùng giữ phiên riêng
      void getSupabase()
        .auth.signOut({ scope: 'local' })
        .finally(() => queryClient.removeQueries({ queryKey: ['auth'] }))
    },
    [queryClient],
  )

  /** Phiên đã quá hạn thì đăng xuất ngay, không cho hiện trang quản trị. */
  const accept = useCallback(
    (next: Session | null) => {
      const expired = next ? evaluate(next).expired : null
      // Không gọi Supabase ngay trong callback của onAuthStateChange (tránh khóa phiên)
      if (expired) window.setTimeout(() => expire(expired), 0)
      else setSession(next)
    },
    [evaluate, expire],
  )

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => accept(data.session))
    // Không gọi Supabase bên trong callback (tránh khóa phiên); chỉ cập nhật state
    const { data } = supabase.auth.onAuthStateChange((_event, next) => accept(next))
    return () => data.subscription.unsubscribe()
  }, [accept])

  const signedIn = Boolean(session)
  useEffect(() => {
    if (!signedIn) return
    const markActivity = () => {
      const now = Date.now()
      if (now - activityRef.current < ACTIVITY_THROTTLE_MS) return
      activityRef.current = now
      writeLastActivity(now)
    }
    const check = () => {
      void getSupabase()
        .auth.getSession()
        .then(({ data }) => {
          if (!data.session) return
          const result = evaluate(data.session)
          if (result.expired) expire(result.expired)
          else
            setWarning(result.warning && result.warning.at !== dismissedRef.current ? result.warning : null)
        })
    }
    // Máy vừa thức dậy hoặc quay lại tab thì kiểm tra ngay
    const onVisible = () => document.visibilityState === 'visible' && check()
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, markActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)
    check()
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, markActivity)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [signedIn, evaluate, expire])

  const continueSession = useCallback(() => {
    if (warning?.reason === 'max') dismissedRef.current = warning.at
    else {
      activityRef.current = Date.now()
      writeLastActivity(activityRef.current)
    }
    setWarning(null)
  }, [warning])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['auth', 'profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  })

  const profile = profileQuery.data ?? null
  const role = profile?.is_active && profile.role ? (profile.role as Role) : null

  const permissionsQuery = useQuery({
    queryKey: ['auth', 'permissions', role],
    queryFn: () => fetchPermissions(role!),
    enabled: Boolean(role),
    staleTime: Infinity,
  })

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
    queryClient.removeQueries({ queryKey: ['auth'] })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const loading =
      session === undefined ||
      (Boolean(userId) && profileQuery.isPending) ||
      (Boolean(role) && permissionsQuery.isPending)
    const permissions = new Set(permissionsQuery.data ?? [])
    return {
      status: loading ? 'loading' : session ? 'signed_in' : 'signed_out',
      session: session ?? null,
      profile,
      role,
      can: (permission: string) => permissions.has(permission),
      signIn,
      signOut,
    }
  }, [
    session,
    userId,
    profile,
    role,
    profileQuery.isPending,
    permissionsQuery.isPending,
    permissionsQuery.data,
    signIn,
    signOut,
  ])

  return (
    <AuthContext value={value}>
      {children}
      {warning && (
        <SessionWarning
          reason={warning.reason}
          at={warning.at}
          onContinue={continueSession}
          onSignOut={() => void signOut()}
        />
      )}
    </AuthContext>
  )
}
