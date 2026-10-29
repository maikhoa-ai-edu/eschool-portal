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
