/**
 * Vercel Cron (vercel.json, mỗi ngày một lần): giữ project Supabase gói miễn phí không bị tạm dừng sau 7 ngày
 * không có hoạt động, kể cả khi website vắng khách (nghỉ hè, nghỉ Tết).
 */
import { pingDatabase } from '../public/seo-core.mjs'
import { originOf, readConfig } from './_config.mjs'

export default async function handler(req, res) {
  const result = await pingDatabase({ config: await readConfig(originOf(req)) })
  res.statusCode = result.ok ? 200 : 503
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`${result.ok ? 'ok' : 'loi'}: ${result.detail}\n`)
}
