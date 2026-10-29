import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RuntimeConfig } from './runtime-config'

let client: SupabaseClient | null = null

/** Gọi một lần khi khởi động, sau khi đã đọc được cấu hình. */
export function initSupabase(config: RuntimeConfig): SupabaseClient {
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}

export function getSupabase(): SupabaseClient {
  if (!client) throw new Error('Supabase chưa được khởi tạo (thiếu cấu hình kết nối)')
  return client
}
