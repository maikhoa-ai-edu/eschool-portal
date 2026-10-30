/**
 * Tải ảnh & văn bản mẫu (supabase/seed-storage/<bucket>/...) lên Storage của Supabase CỤC BỘ,
 * khớp với các đường dẫn "seed/..." trong supabase/seed.sql. Chạy tự động sau `npm run db:reset`.
 *
 *   node scripts/seed-storage.ts
 *
 * Khóa service_role lấy từ `supabase status` (chỉ có trên máy/CI), không bao giờ dùng cho site thật.
 */
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_DIR = join(ROOT, 'supabase', 'seed-storage')

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

function localKeys(): { url: string; serviceKey: string } {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  }
  const out = execSync('supabase status -o env', { encoding: 'utf8' })
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  if (!env.API_URL || !env.SERVICE_ROLE_KEY)
    throw new Error('Không đọc được API_URL/SERVICE_ROLE_KEY từ supabase status')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.API_URL)) {
    throw new Error(`Chỉ chạy với Supabase cục bộ (đang là ${env.API_URL})`)
  }
  return { url: env.API_URL, serviceKey: env.SERVICE_ROLE_KEY }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

async function main() {
  const { url, serviceKey } = localKeys()
  let count = 0
  for (const bucket of readdirSync(SEED_DIR)) {
    for (const file of walk(join(SEED_DIR, bucket))) {
      const path = relative(join(SEED_DIR, bucket), file).split('\\').join('/')
      const contentType = CONTENT_TYPES[extname(file).toLowerCase()]
      if (!contentType) continue
      const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: readFileSync(file),
      })
      if (!res.ok) throw new Error(`${bucket}/${path}: ${res.status} ${await res.text()}`)
      count++
    }
  }
  console.log(`Đã tải ${count} file mẫu lên Storage cục bộ`)
}

await main()
