/** Dùng chung cho các Vercel Function (tên bắt đầu bằng _ nên Vercel không coi là một hàm riêng). */

/** Cấu hình đọc từ biến môi trường VITE_*, không có thì đọc /config.json của chính website. */
export async function readConfig(origin) {
  const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey } = process.env
  if (supabaseUrl && supabaseAnonKey) return { supabaseUrl, supabaseAnonKey }
  try {
    const res = await fetch(`${origin}/config.json`)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

export function originOf(req) {
  return `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers['x-forwarded-host'] ?? req.headers.host}`
}
