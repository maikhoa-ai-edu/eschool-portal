import { strToU8, zipSync } from 'fflate'
import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, SAMPLE_PDF, screenshotPath, uniqueSuffix } from './helpers.ts'

/** Giai đoạn 8.6 đợt C: tab Video/Tài nguyên ở khối Thư viện, kế hoạch công tác. */
test.afterAll(async () => {
  await sql(`delete from public.videos where title like 'E2E %'`)
  await sql(`delete from public.work_plans where title like 'E2E %'`)
})

function planDocx(): Buffer {
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`
  const row = (...cells: string[]) => `<w:tr>${cells.map(cell).join('')}</w:tr>`
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${row(
    'STT',
    'Thời gian',
    'Nội dung công việc',
    'Người thực hiện',
  )}${row('1', '01/12', 'E2E Họp giao ban', 'Hiệu trưởng')}${row('2', '05/12', 'E2E Kiểm tra hồ sơ', 'Tổ trưởng')}</w:tbl></w:body></w:document>`
  return Buffer.from(zipSync({ 'word/document.xml': strToU8(xml) }))
}

test('khối Thư viện có tab Video và Tài nguyên, trang riêng nhúng đúng video', async ({ page }, info) => {
  await page.goto('/')
  const tabs = page.getByRole('tablist', { name: 'Chọn thư viện' })
  await tabs.scrollIntoViewIfNeeded()
  await tabs.getByRole('tab', { name: 'Tài nguyên' }).click()
  await expect(page.getByRole('link', { name: /Phần mềm vnEdu/ })).toHaveAttribute('target', '_blank')
  await tabs.getByRole('tab', { name: 'Video' }).click()
  await page.getByRole('link', { name: 'Hoạt động ngoại khóa' }).click()
  await expect(page).toHaveURL(/\/video\?xem=/)
  await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/ScMzIvxBSi4/)
  await page.screenshot({ path: screenshotPath('videos', info), fullPage: true })
})

test('menu chính có Kế hoạch công tác và mở được trang', async ({ page }, info) => {
  await page.goto('/')
  if (info.project.name !== 'desktop') await page.getByRole('button', { name: 'Mở menu' }).click()
  await page
    .getByRole('navigation', { name: 'Menu chính' })
    .getByRole('link', { name: 'Kế hoạch công tác' })
    .click()
  await expect(page.getByRole('heading', { name: 'Kế hoạch công tác', level: 1 })).toBeVisible()
})

test('xóa hết video, tài nguyên ẩn: khối Thư viện trở lại như cũ, không có tab', async ({ page }) => {
  await sql(
    `update public.module_settings set is_enabled = false where module_key in ('videos', 'resources')`,
  )
  try {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Thư viện ảnh', level: 2 })).toBeVisible()
    await expect(page.getByRole('tablist', { name: 'Chọn thư viện' })).toHaveCount(0)
  } finally {
    await sql(
      `update public.module_settings set is_enabled = true where module_key in ('videos', 'resources')`,
    )
  }
})

test('quản trị từ chối link video không phải YouTube/Drive', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'admin@demo.local', '/admin/video')
  const title = `E2E Video ${uniqueSuffix()}`
  await page.getByLabel('Tên video').fill(title)
  await page.getByLabel('Link video').fill('https://evil.example/video')
  await expect(page.getByText('Chỉ nhận link video YouTube hoặc Google Drive.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thêm video' })).toBeDisabled()
  await page.getByLabel('Link video').fill('https://youtu.be/abc123')
  await page.getByRole('button', { name: 'Thêm video' }).click()
  await expect(page.getByText(title)).toBeVisible()
})

test('kế hoạch: nhập từ Word, sửa, đính kèm PDF, đăng; khách xem được; nháp thì không', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'admin@demo.local', '/admin/ke-hoach/moi')
  await page.getByLabel('Tháng').fill('12')
  await page.getByLabel('Năm').fill('2099')
  await page.getByLabel('Tiêu đề').fill('E2E Kế hoạch tháng 12')
  await page.getByLabel('Chọn file Word kế hoạch').setInputFiles({
    name: 'ke-hoach.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: planDocx(),
  })
  await expect(page.getByText('Đã lấy 2 hàng từ file.')).toBeVisible()
  await expect(page.getByLabel('Nội dung hàng 1')).toHaveValue('E2E Họp giao ban')
  await expect(page.getByLabel('Người thực hiện hàng 2')).toHaveValue('Tổ trưởng')
  await page.getByLabel('Nội dung hàng 2').fill('E2E Kiểm tra hồ sơ đã sửa')

  await page.getByLabel('Chọn file PDF kế hoạch').setInputFiles({
    name: 'ke-hoach.pdf',
    mimeType: 'application/pdf',
    buffer: SAMPLE_PDF,
  })

  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(page).toHaveURL(/\/admin\/ke-hoach\/[0-9a-f-]{36}$/)

  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  await guest.goto('http://localhost:3000/ke-hoach')
  await expect(guest.getByRole('heading', { name: 'Kế hoạch công tác tháng 11/2026' })).toBeVisible()
  await expect(guest.getByRole('option', { name: 'Tháng 12/2099' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Đăng kế hoạch' }).click()
  await expect(page.getByText('Đã đăng kế hoạch.')).toBeVisible()

  await guest.reload()
  await expect(guest.getByRole('heading', { name: 'E2E Kế hoạch tháng 12' })).toBeVisible()
  await expect(guest.getByRole('cell', { name: 'E2E Kiểm tra hồ sơ đã sửa' })).toBeVisible()
  await expect(guest.getByRole('link', { name: 'Tải file PDF' })).toBeVisible()
  await guest.screenshot({ path: screenshotPath('plan-public', info), fullPage: true })
  await guestContext.close()

  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Xóa', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ke-hoach$/)
})
