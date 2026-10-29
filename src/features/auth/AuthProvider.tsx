import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue, type Profile, type Role } from './auth-context'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_active')
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
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Không gọi Supabase bên trong callback (tránh khóa phiên); chỉ cập nhật state
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
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

  return <AuthContext value={value}>{children}</AuthContext>
}
