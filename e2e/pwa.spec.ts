import { expect, test } from '@playwright/test'

// Chạy trên bản build thật qua public/server.mjs (cổng 3002), CSDL seed cục bộ
const BASE = 'http://localhost:3002'
test.use({ baseURL: BASE })

const meta = (html: string, name: string) =>
  new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)?.[1] ?? null

test.describe('OG & sitemap trên CSDL thật', () => {
  const CASES = [
    ['/tin-tuc/clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh', 'Câu lạc bộ STEM ra mắt', 'slide-stem-rsw.jpg'],
    ['/thu-vien-anh/khuon-vien-va-thu-vien-nha-truong', 'Khuôn viên và thư viện', 'khuon-vien-rsw.jpg'],
    ['/trang/gioi-thieu', 'Giới thiệu', 'slide-hoc-tap-rsw.jpg'],
    ['/chuyen-de/hoc-tap-va-lam-theo-bac', 'Học tập và làm theo Bác', 'slide-bac-ho-rsw.jpg'],
    [
      '/van-ban/00000000-0000-0000-0000-0000000000d1',
      'Kế hoạch học tập và làm theo Bác',
      'slide-hoc-tap-rsw.jpg',
    ],
  ] as const

  for (const [path, title, image] of CASES) {
    test(`thẻ riêng cho ${path}`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      const html = await res.text()
      expect(meta(html, 'og:title')).toContain(title)
      expect(meta(html, 'og:image')).toContain(image)
      expect(meta(html, 'og:description')).toBeTruthy()
      expect(html).toContain('id="root"')
      // Ảnh OG mở được thật
      expect((await request.get(meta(html, 'og:image')!)).status()).toBe(200)
    })
  }

  test('bài chưa đăng: 404, không lộ tiêu đề, không có trong sitemap', async ({ request }) => {
    const res = await request.get('/tin-tuc/thong-tin-tuyen-sinh-lop-6-va-lop-10')
    expect(res.status()).toBe(404)
    const html = await res.text()
    expect(html).not.toContain('Thông tin tuyển sinh lớp 6 và lớp 10')
    expect(meta(html, 'robots')).toBe('noindex')

    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).not.toContain('thong-tin-tuyen-sinh-lop-6-va-lop-10')
    expect(xml).toContain(`${BASE}/tin-tuc/clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh`)
    expect(xml).toContain(`${BASE}/chuyen-de/hoc-tap-va-lam-theo-bac`)
    expect(xml).toContain(`${BASE}/thu-vien-anh/khuon-vien-va-thu-vien-nha-truong`)
  })

  test('robots.txt trỏ tới sitemap, chặn trang quản trị', async ({ request }) => {
    const text = await (await request.get('/robots.txt')).text()
    expect(text).toContain(`Sitemap: ${BASE}/sitemap.xml`)
    expect(text).toContain('Disallow: /admin')
  })
})

test.describe('PWA', () => {
  test('cài được: manifest theo tên trường, không có lỗi cài đặt', async ({ page, context }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /Vĩnh Phong/ })).toBeAttached()
    await page.evaluate(() => navigator.serviceWorker.ready)
    const cdp = await context.newCDPSession(page)
    const { url, errors, data } = await cdp.send('Page.getAppManifest')
    expect(url).toMatch(/^blob:/)
    expect(errors).toEqual([])
    const manifest = JSON.parse(data!) as { name: string; start_url: string; theme_color: string }
    expect(manifest.name).toContain('Vĩnh Phong')
    expect(manifest.start_url).toBe(`${BASE}/`)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    expect(installabilityErrors).toEqual([])
  })

  test('mất mạng hiện trang báo; có mạng lại thì bình thường', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect(page.locator('html')).toBeAttached()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

    await context.setOffline(true)
    await page.goto('/tin-tuc').catch(() => undefined)
    await expect(page.getByRole('heading', { name: 'Không có kết nối mạng' })).toBeVisible()

    await context.setOffline(false)
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.getByRole('heading', { name: 'Không có kết nối mạng' })).toHaveCount(0)
  })

  test('service worker không giữ cấu hình và file SQL', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    const keys = await page.evaluate(async () => {
      await fetch('/install.sql')
      await fetch('/upgrades/index.json')
      const all: string[] = []
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) all.push(new URL(req.url).pathname)
      }
      return all
    })
    expect(keys.filter((k) => /config|install|upgrades/.test(k))).toEqual([])
  })

  test('ảnh dùng bản nhỏ, không tải file gốc lớn trên điện thoại', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    const images: string[] = []
    page.on('response', (r) => {
      if (r.request().resourceType() === 'image') images.push(r.url())
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(images.some((u) => /-rsw\.w\d+\.webp/.test(u))).toBe(true)
    expect(images.filter((u) => /-rsw\.jpg/.test(u))).toEqual([])
    await context.close()
  })
})
