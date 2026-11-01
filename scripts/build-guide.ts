/**
 * Chuyển docs/HUONG-DAN-CAI-DAT.md thành PDF bằng Chromium của Playwright.
 *
 *   node scripts/build-guide.ts <đường-dẫn-ra.pdf>
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { marked } from 'marked'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const FONTS = join(ROOT, 'node_modules/@fontsource/be-vietnam-pro/files')

const output = process.argv[2]
if (!output) {
  console.error('Cách dùng: node scripts/build-guide.ts <đường-dẫn-ra.pdf>')
  process.exit(1)
}

const fontFace = (subset: string, weight: number, range: string) => `@font-face {
  font-family: 'Be Vietnam Pro'; font-weight: ${weight}; unicode-range: ${range};
  src: url('${pathToFileURL(join(FONTS, `be-vietnam-pro-${subset}-${weight}-normal.woff2`)).href}') format('woff2');
}`
const VIETNAMESE =
  'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
const LATIN = 'U+0000-00FF,U+2000-206F,U+2190-2193'

const css = `
${[400, 700].flatMap((w) => [fontFace('latin', w, LATIN), fontFace('vietnamese', w, VIETNAMESE)]).join('\n')}
body { font: 11pt/1.55 'Be Vietnam Pro', sans-serif; color: #1f2937; }
h1 { font-size: 24pt; color: #14532d; margin: 0 0 12pt; }
h2 { font-size: 16pt; color: #14532d; margin: 22pt 0 8pt; border-bottom: 1.5pt solid #14532d; padding-bottom: 3pt; break-after: avoid; }
h3 { font-size: 12.5pt; margin: 14pt 0 5pt; break-after: avoid; }
li { margin: 3pt 0; }
code { background: #f1f5f9; padding: 0 3pt; border-radius: 3pt; font-size: 9.5pt; word-break: break-all; }
pre { background: #f1f5f9; padding: 8pt; white-space: pre-wrap; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fef9c3; border-left: 3pt solid #ca8a04; break-inside: avoid; }
blockquote p { margin: 0; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 8pt 0; }
th, td { border: 0.75pt solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #f1f5f9; }
tr { break-inside: avoid; }
img { display: block; max-width: 100%; max-height: 90mm; margin: 8pt auto; border: 0.75pt solid #cbd5e1; }
`

const markdown = readFileSync(join(DOCS, 'HUONG-DAN-CAI-DAT.md'), 'utf8')
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
const missing = [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
  .map((m) => m[1]!)
  .filter((src) => !existsSync(join(DOCS, src)))
if (missing.length > 0) {
  console.error(`Thiếu ảnh trong hướng dẫn: ${missing.join(', ')}`)
  process.exit(1)
}
const body = await marked.parse(markdown)
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><base href="${pathToFileURL(DOCS).href}/"><style>${css}</style></head><body>${body}</body></html>`

mkdirSync(dirname(resolve(output)), { recursive: true })
const page_html = `${resolve(output)}.tmp.html`
writeFileSync(page_html, html)
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(page_html).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({
    path: output,
    format: 'A4',
    margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-size:8pt;width:100%;text-align:center;color:#64748b">eSchool Portal ${version} · Trang <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    printBackground: true,
  })
} finally {
  await browser.close()
  rmSync(page_html, { force: true })
}
