import { expect, test } from '@playwright/test'
import { login } from './helpers.ts'

test('trang Giới thiệu dạng landing có đủ các mục, không cuộn ngang', async ({ page }) => {
  await page.goto('/trang/gioi-thieu')
  await expect(page.getByRole('heading', { name: 'Giới thiệu', level: 1 })).toBeAttached()
  for (const name of [
    'Lịch sử hình thành',
    'Sứ mệnh',
    'Tầm nhìn',
    'Giá trị cốt lõi',
    'Khuôn viên',
    'Bản đồ',
  ]) {
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
  }
  await expect(page.getByRole('img', { name: /^Tập thể/ })).toBeVisible()
  await expect(page.locator('iframe[src^="https://www.google.com/maps"]')).toHaveCount(1)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('cơ cấu tổ chức: bấm để xổ danh sách, không hiện người đang ẩn', async ({ page }) => {
  await page.goto('/trang/co-cau-to-chuc')
  // Bộ phận đầu mở sẵn, bộ phận khác đóng tới khi bấm
  await expect(page.getByText('Nguyễn Văn An').locator('visible=true').first()).toBeVisible()
  await expect(page.getByText('Võ Minh Đức').locator('visible=true')).toHaveCount(0)
  await page.getByText('Tổ chuyên môn 1').click()
  await expect(page.getByText('Võ Minh Đức').locator('visible=true').first()).toBeVisible()
  await expect(page.getByText('Giáo viên Đang Ẩn')).toHaveCount(0)
})

test('kế hoạch: lịch đánh dấu sự kiện, danh sách các tháng', async ({ page }) => {
  await page.goto('/ke-hoach')
  await page.getByRole('link', { name: 'Tháng 11/2026' }).click()
  await expect(page.getByRole('heading', { name: 'Lịch tháng 11/2026' })).toBeVisible()
  await expect(page.getByText('(có sự kiện quan trọng)')).toHaveCount(13)
  await expect(page.getByText('03/11 - 14/11').last()).toBeVisible()
  await page.getByRole('link', { name: 'Tháng 10/2026' }).click()
  await expect(page.getByRole('heading', { name: 'Kế hoạch công tác tháng 10/2026' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lịch tháng 10/2026' })).toBeVisible()
  await expect(page.getByText('(có sự kiện quan trọng)')).toHaveCount(1)
  await page.getByRole('button', { name: 'Tháng sau' }).click()
  await expect(page.getByRole('heading', { name: 'Lịch tháng 11/2026' })).toBeVisible()
})

test('sơ đồ trang mở từ icon cạnh nút đăng nhập', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sơ đồ trang' }).click()
  await expect(page).toHaveURL(/\/so-do-trang$/)
  await expect(page.getByRole('heading', { name: 'Sơ đồ trang', level: 1 })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Cơ cấu tổ chức' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: '/admin' })).toHaveCount(0)
})

test('quản trị: thêm bộ phận, thành viên; đánh dấu sự kiện cần có ngày', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'admin@demo.local', '/admin/co-cau-to-chuc')
  await page.getByLabel('Tên bộ phận').fill('E2E Tổ thử')
  await page.getByRole('button', { name: 'Lưu bộ phận' }).click()
  await page.getByRole('button', { name: 'Thêm thành viên vào E2E Tổ thử' }).click()
  await page.getByLabel('Họ tên').fill('E2E Giáo viên')
  await page.getByLabel('Năm vào ngành').fill('2015')
  await page.getByRole('button', { name: 'Lưu thành viên' }).click()
  await expect(page.getByText('E2E Giáo viên')).toBeVisible()

  await page.goto('/trang/co-cau-to-chuc')
  await page.getByText('E2E Tổ thử').click()
  await expect(page.getByRole('cell', { name: 'E2E Giáo viên' })).toBeVisible()

  await page.goto('/admin/co-cau-to-chuc')
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Xóa E2E Tổ thử' }).click()
  await expect(page.getByText('E2E Giáo viên')).toHaveCount(0)

  await page.goto('/admin/ke-hoach/moi')
  await page.getByLabel('Nội dung hàng 1').fill('E2E Sự kiện')
  await page.getByLabel('Sự kiện quan trọng hàng 1').check()
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(page.getByText('Sự kiện quan trọng cần có ngày')).toBeVisible()
})
