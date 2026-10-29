/**
 * Cấu hình lúc chạy (runtime config).
 *
 * Một bản build dùng chung cho mọi trường: thông tin kết nối Supabase được đọc
 * từ /config.json do trình cài đặt tạo ra, không đóng cứng lúc build.
 * Khi phát triển trên máy (chưa có config.json) thì dùng biến VITE_* trong .env.local.
 */
import { z } from 'zod'

export const runtimeConfigSchema = z.object({
  supabaseUrl: z.url({ protocol: /^https?$/ }),
  supabaseAnonKey: z.string().min(20),
})

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

export type ConfigState =
  | { status: 'configured'; source: 'config.json' | 'env'; config: RuntimeConfig }
  | { status: 'unconfigured'; reason: string }

export const CONFIG_PATH = '/config.json'

async function fetchConfigFile(fetchImpl: typeof fetch): Promise<unknown> {
  try {
    const res = await fetchImpl(CONFIG_PATH, { cache: 'no-store' })
    if (!res.ok) return null
    // Hosting SPA thường trả index.html cho file không tồn tại, nên không tin status 200
    const text = await res.text()
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function loadRuntimeConfig(
  env: Record<string, string | undefined> = import.meta.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ConfigState> {
  const fromFile = runtimeConfigSchema.safeParse(await fetchConfigFile(fetchImpl))
  if (fromFile.success) {
    return { status: 'configured', source: 'config.json', config: fromFile.data }
  }

  const fromEnv = runtimeConfigSchema.safeParse({
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
  })
  if (fromEnv.success) {
    return { status: 'configured', source: 'env', config: fromEnv.data }
  }

  return { status: 'unconfigured', reason: `Không tìm thấy ${CONFIG_PATH} hợp lệ` }
}
