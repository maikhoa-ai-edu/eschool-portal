/**
 * Tạo bản thu nhỏ .w480/.w960/.w1600.webp cho ảnh mẫu tên "...-rsw.jpg" trong supabase/seed-storage/media
 * (giống việc trình duyệt làm lúc người dùng tải ảnh lên, xem uploadImage). Kết quả đã nằm sẵn trong repo.
 *
 *   node scripts/make-seed-variants.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA = join(ROOT, 'supabase', 'seed-storage', 'media')

const browser = await chromium.launch()
const page = await browser.newPage()
for (const entry of readdirSync(MEDIA, { recursive: true, encoding: 'utf8' })) {
  if (!entry.endsWith('-rsw.jpg')) continue
  const bytes = readFileSync(join(MEDIA, entry))
  for (const width of [480, 960, 1600]) {
    const data = await page.evaluate(
      async ({ url, width }) => {
        const img = new Image()
        img.src = url
        await img.decode()
        const scale = Math.min(1, width / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/webp', 0.75)
      },
      { url: `data:image/jpeg;base64,${bytes.toString('base64')}`, width },
    )
    const out = join(MEDIA, entry.replace(/\.jpg$/, `.w${width}.webp`))
    writeFileSync(out, Buffer.from(data.split(',')[1]!, 'base64'))
  }
  console.log(entry)
}
await browser.close()
