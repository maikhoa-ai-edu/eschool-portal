import { deflateSync } from 'node:zlib'
import { expect, type Browser, type Page, type TestInfo } from '@playwright/test'

export const PASSWORD = 'demo1234'

export async function login(page: Page, email: string, next = '/admin') {
  await page.goto(`/dang-nhap?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/\/dang-nhap/)
}

/** Một "máy" khác: ngữ cảnh trình duyệt riêng (phiên đăng nhập, bộ nhớ đệm riêng). */
export async function otherMachine(browser: Browser, info: TestInfo): Promise<Page> {
  const { baseURL, locale, timezoneId, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    info.project.use
  const context = await browser.newContext({
    baseURL,
    locale,
    timezoneId,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
  })
  return context.newPage()
}

export function screenshotPath(name: string, info: TestInfo): string {
  return `test-results/screens/${name}-${info.project.name}.png`
}

/** Chuỗi duy nhất cho mỗi lần chạy để chạy lại nhiều lần không bị trùng dữ liệu. */
export function uniqueSuffix(): string {
  return Date.now().toString(36)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Ảnh PNG thật (dải màu chéo) để thử tải ảnh lên mà không cần file mẫu trong repo. */
export function makePng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const shade = (x + y) / (width + height)
      raw[row + 1 + x * 3] = Math.round(r * (1 - shade) + 255 * shade)
      raw[row + 2 + x * 3] = Math.round(g * (1 - shade) + 255 * shade)
      raw[row + 3 + x * 3] = Math.round(b * (1 - shade) + 255 * shade)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // độ sâu màu
  header[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** PDF tối giản một trang (đủ để tải lên và tải về). */
export const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 300 300]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
)
