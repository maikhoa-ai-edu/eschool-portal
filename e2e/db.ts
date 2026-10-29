/**
 * Truy cập thẳng Postgres của Supabase cục bộ (quyền postgres) để dựng trạng thái cho E2E.
 * Chỉ dùng trong kiểm thử, không bao giờ nằm trong ứng dụng.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    return (await client.query<T>(text, params)).rows
  } finally {
    await client.end()
  }
}

/** Thông tin kết nối mà người cài sẽ dán vào bước 2 (lấy từ .env.local giống dev server). */
export function localSupabase(): { url: string; anonKey: string } {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]!.replace(/^['"]|['"]$/g, '')]),
  )
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)
    throw new Error('.env.local thiếu VITE_SUPABASE_*')
  return { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY }
}

interface Snapshot {
  settings: Array<{ key: string; value: unknown }>
  modules: Array<{ module_key: string; is_enabled: boolean }>
}

export const INSTALL_CODE = 'E2E0C0DE1234'
export const INSTALLER_EMAIL = 'hieutruong@e2e.local'

/** Đưa CSDL seed về trạng thái vừa chạy install.sql: chưa có SUPER_ADMIN, chưa hoàn tất. */
export async function resetToFreshInstall(): Promise<Snapshot> {
  const settings = await sql<{ key: string; value: unknown }>('select key, value from public.site_settings')
  const modules = await sql<{ module_key: string; is_enabled: boolean }>(
    'select module_key, is_enabled from public.module_settings',
  )
  await sql(`
    delete from auth.users where email = '${INSTALLER_EMAIL}';
    update public.profiles set role = null where role = 'SUPER_ADMIN';
    update private.install_state set install_code = '${INSTALL_CODE}', bootstrapped_at = null, completed_at = null;
  `)
  // Giá trị trung tính giống hệt migration core (CSDL vừa cài chưa có thông tin trường nào)
  const blankIdentity = Object.fromEntries(
    ['short_name', 'governing_body', 'slogan', 'address', 'phone', 'email', 'principal']
      .concat(['facebook_url', 'youtube_url', 'zalo_url'])
      .map((k) => [k, '']),
  )
  await sql("update public.site_settings set value = $1 where key = 'school_identity'", [
    JSON.stringify({ school_name: 'Tên trường', ...blankIdentity }),
  ])
  await sql("update public.site_settings set value = $1 where key = 'branding'", [
    JSON.stringify({
      primary_color: '#002B66',
      primary_light_color: '#003B8E',
      accent_color: '#D97706',
      logo_url: null,
      favicon_url: null,
      banner_url: null,
    }),
  ])
  return { settings, modules }
}

/** Trả lại đúng dữ liệu seed để các kiểm thử khác không bị ảnh hưởng. */
export async function restoreSeed(snapshot: Snapshot): Promise<void> {
  await sql(`
    update public.profiles set role = 'SUPER_ADMIN' where email = 'superadmin@demo.local';
    delete from auth.users where email = '${INSTALLER_EMAIL}';
    update private.install_state set install_code = null, bootstrapped_at = now(), completed_at = now();
  `)
  for (const s of snapshot.settings) {
    await sql('update public.site_settings set value = $2 where key = $1', [s.key, JSON.stringify(s.value)])
  }
  for (const m of snapshot.modules) {
    await sql('update public.module_settings set is_enabled = $2 where module_key = $1', [
      m.module_key,
      m.is_enabled,
    ])
  }
}
