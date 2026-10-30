import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { RuntimeConfig } from './runtime-config'

export type AppSupabaseClient = SupabaseClient<Database>

let client: AppSupabaseClient | null = null

/** Gọi một lần khi khởi động, sau khi đã đọc được cấu hình. */
export function initSupabase(config: RuntimeConfig): AppSupabaseClient {
  client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}

export function getSupabase(): AppSupabaseClient {
  if (!client) throw new Error('Supabase chưa được khởi tạo (thiếu cấu hình kết nối)')
  return client
}

/** Id người đang đăng nhập (ghi vào created_by/author_id; RLS kiểm tra lại khớp auth.uid()). */
export async function requireUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
  return id
}
