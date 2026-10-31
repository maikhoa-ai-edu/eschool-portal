import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, screenshotPath } from './helpers.ts'

/**
 * Giai đoạn 8.6 đợt A: đầu trang, tìm kiếm, chữ chạy, dải tin, tab Xem nhiều, lối tắt, thông báo mới nhất,
 * văn bản chạy lên, chân trang. Cấu hình bị đổi được khôi phục sau mỗi test.
 */
const KEYS = ['site_chrome', 'marquee', 'homepage'] as const
const saved: Record<string, unknown> = {}

test.beforeEach(async () => {
  for (const key of KEYS) {
    const rows = await sql<{ value: unknown }>(`select value from public.site_settings where key = $1`, [key])
    saved[key] = rows[0]!.value
  }
})

test.afterEach(async () => {
  for (const key of KEYS) {
    await sql(`update public.site_settings set value = $1 where key = $2`, [JSON.stringify(saved[key]), key])
  }
})

test('trang chủ có icon mạng xã hội, dải tin, tab Xem nhiều và khối nổi bật', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Facebook' }).first()).toBeVisible()

  const strip = page.getByRole('region', { name: 'Tin mới có ảnh' })
  await expect(strip.getByRole('listitem').first()).toBeVisible()

  const rail = page.getByRole('region', { name: 'Tin tiêu điểm và xem nhiều' })
  await expect(rail.getByRole('tabpanel').getByRole('listitem')).toHaveCount(5)
  await rail.getByRole('tab', { name: 'Xem nhiều' }).click()
  await expect(rail.getByRole('tab', { name: 'Xem nhiều' })).toHaveAttribute('aria-selected', 'true')
  await expect(rail.getByRole('tabpanel').getByRole('listitem').first()).toBeVisible()

  await expect(page.getByText('Mới', { exact: true })).toHaveCount(1)

  const shortcuts = page.getByRole('navigation', { name: 'Lối tắt' }).getByRole('listitem')
  const tops = await shortcuts.evaluateAll((items) => items.map((i) => i.getBoundingClientRect().top))
  expect(new Set(tops).size).toBe(1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: screenshotPath('portal-home', info), fullPage: true })
})

test('kính lúp mở hộp tìm kiếm và trả kết quả không dấu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở tìm kiếm' }).click()
  const box = page.getByRole('searchbox', { name: 'Từ khóa tìm kiếm' })
  await box.fill('hoi giang')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/tim-kiem\?q=hoi%20giang/)
  await expect(page.getByRole('status')).toContainText('kết quả')
})

test('cấu hình cũ không có site_chrome: không icon, không kính lúp', async ({ page }) => {
  await sql(`update public.site_settings set value = '{}' where key = 'site_chrome'`)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kết nối' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở tìm kiếm' })).toHaveCount(0)
})

test('chữ chạy đổi nhãn, màu, tốc độ từ quản trị', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'admin@demo.local')
  await page.goto('/admin/trang-chu?tab=chu-chay')
  await page.getByLabel('Nhãn đầu dòng').fill('Chủ đề năm học')
  await page.getByLabel('Mã màu nền').fill('#7F1D1D')
  await page.getByLabel('Tốc độ chạy').selectOption('25')
  await page.getByRole('button', { name: 'Lưu dòng chữ chạy' }).click()
  await expect(page.getByText('Đã lưu dòng chữ chạy.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Chủ đề năm học')).toBeVisible()
  await expect(page.locator('.marquee-track').first()).toHaveCSS('animation-duration', '25s')
})

test('chân trang thêm dòng thông tin từ quản trị', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'admin@demo.local')
  await page.goto('/admin/trang-chu?tab=dau-chan-trang')
  await page.getByRole('button', { name: 'Thêm dòng' }).click()
  const rows = page.getByRole('textbox', { name: /^Nội dung dòng/ })
  await rows.last().fill('E2E Hotline tuyển sinh')
  await page.getByRole('button', { name: 'Lưu đầu và chân trang' }).click()
  await expect(page.getByText('Đã lưu đầu trang và chân trang.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('contentinfo').getByText('E2E Hotline tuyển sinh')).toBeVisible()
})
