/**
 * Ghép các migration thành một file install.sql để người cài dán vào SQL Editor của Supabase.
 *
 *   node scripts/build-install-sql.ts [đường-dẫn-ra]   (mặc định: dist/install.sql)
 *
 * Vite cũng dùng hàm này: phục vụ /install.sql khi chạy dev và đưa file vào dist/ khi build.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

export function listMigrations(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

export function buildInstallSql(dir: string = MIGRATIONS_DIR): string {
  const files = listMigrations(dir)
  if (files.length === 0) throw new Error(`Không có migration nào trong ${dir}`)

  const parts = [
    '-- eSchool Portal: install.sql (tự sinh từ supabase/migrations, KHÔNG sửa tay)',
    '-- Cách dùng: Supabase Dashboard -> SQL Editor -> New query -> dán toàn bộ -> Run.',
    '-- Dòng cuối cùng trả về MÃ CÀI ĐẶT; nhập mã đó vào trình cài đặt trên website.',
    '',
    'begin;',
    '',
    '-- Chỉ chạy trên project mới: tránh ghi đè một trường đã cài',
    'do $guard$',
    'begin',
    "  if to_regclass('public.app_meta') is not null then",
    "    raise exception 'CSDL này đã được cài eSchool Portal. Không chạy lại install.sql; muốn nâng cấp hãy dùng file upgrade.';",
    '  end if;',
    'end',
    '$guard$;',
  ]

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').trim()
    parts.push('', `-- ===== ${file} =====`, '', sql)
  }

  parts.push(
    '',
    'commit;',
    '',
    '-- Mã cài đặt (dùng một lần ở bước "Tạo quản trị viên" của trình cài đặt)',
    'select install_code as "Mã cài đặt" from private.install_state;',
    '',
  )
  return parts.join('\n')
}

export interface UpgradeFile {
  /** Phiên bản schema sau khi chạy */
  version: string
  /** Phiên bản schema phải có trước khi chạy */
  from: string
  file: string
  sql: string
}

const VERSION_LINE = /update public\.app_meta set value = '(\d+\.\d+\.\d+)'/g

/** Mỗi lần tăng schema_version là một bước nâng cấp; migration đầu tiên chỉ dùng khi cài mới. */
export function buildUpgrades(dir: string = MIGRATIONS_DIR): UpgradeFile[] {
  const upgrades: UpgradeFile[] = []
  let current: string | null = null
  let pending: string[] = []
  for (const name of listMigrations(dir)) {
    const body = readFileSync(join(dir, name), 'utf8').trim()
    pending.push(`-- ===== ${name} =====\n\n${body}`)
    const version = [...body.matchAll(VERSION_LINE)].at(-1)?.[1]
    if (!version) continue
    if (current) {
      upgrades.push({
        version,
        from: current,
        file: `${version}.sql`,
        sql: [
          `-- eSchool Portal: nâng cấp CSDL ${current} -> ${version} (tự sinh từ supabase/migrations, KHÔNG sửa tay)`,
          'begin;',
          '',
          'do $guard$',
          'begin',
          `  if public.get_schema_version() <> '${current}' then`,
          `    raise exception 'CSDL phải đang ở phiên bản ${current}. Hãy chạy các bước nâng cấp theo đúng thứ tự.';`,
          '  end if;',
          'end',
          '$guard$;',
          '',
          ...pending,
          '',
          'commit;',
        ].join('\n'),
      })
    }
    current = version
    pending = []
  }
  return upgrades
}

export function upgradesIndex(upgrades: UpgradeFile[] = buildUpgrades()): string {
  return JSON.stringify(upgrades.map(({ version, from, file }) => ({ version, from, file })))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] ?? join(ROOT, 'dist', 'install.sql'))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, buildInstallSql(), 'utf8')
  console.log(`Đã ghi ${out}`)
}
