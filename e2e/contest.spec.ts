import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, otherMachine } from './helpers.ts'

const CONTEST_ID = '00000000-0000-0000-0000-0000000000f5'

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
}

test('khách xem lưới bài dự thi, mở bài kiểu Thư tri ân, được mời đăng nhập để bình chọn', async ({
  page,
}) => {
  await page.goto('/chuyen-de/tri-an-thay-co')
  await expect(page.getByRole('heading', { name: 'Bài dự thi', level: 2 })).toBeVisible()
  const card = page.getByRole('link', { name: /Người lái đò thầm lặng/ })
  await expect(card).toContainText('Trần Ngọc Hân')
  await expect(card).toContainText('Lớp 9A1')
  await expect(card).toContainText('3')
  // Bài không có tóm tắt vẫn có đoạn trích lấy từ đầu bài
  await expect(page.getByRole('link', { name: /Bức thư gửi cô giáo cũ/ })).toContainText('Cô kính mến')
  await noHorizontalScroll(page)

  await card.click()
  await expect(page.getByRole('heading', { name: 'Người lái đò thầm lặng', level: 1 })).toBeVisible()
  await expect(page.locator('article.letter-paper')).toBeVisible()
  await expect(page.getByText('Bài dự thi · Viết về kỷ niệm sâu sắc')).toBeVisible()
  await expect(page.getByText('Lớp 9A1')).toBeVisible()
  await expect(page.getByText('3 lượt bày tỏ cảm xúc')).toBeVisible()
  await expect(page.getByText(/^Hạn bình chọn:/)).toBeVisible()
  // Khách không bấm được, nút dẫn tới trang đăng nhập
  await expect(page.getByRole('link', { name: /Yêu thích/ })).toHaveAttribute('href', /\/dang-nhap\?next=/)
  await expect(page.getByRole('button', { name: 'Sao chép liên kết' })).toBeVisible()
  await noHorizontalScroll(page)
})

test.describe('bình chọn và xếp hạng', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng đăng nhập kiểm tra trên desktop')

  test('mỗi tài khoản một lượt, đổi hoặc bỏ được; quản trị thấy bảng xếp hạng và tải CSV', async ({
    browser,
    page,
  }, info) => {
    await login(page, 'editor@demo.local', '/tin-tuc/mai-truong-va-hang-phuong-gia')
    await expect(page.getByText('1 lượt bày tỏ cảm xúc')).toBeVisible()
    const grateful = page.getByRole('button', { name: /Biết ơn/ })
    await grateful.click()
    await expect(grateful).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('2 lượt bày tỏ cảm xúc')).toBeVisible()

    // Đổi sang loại khác: tổng không tăng
    await page.getByRole('button', { name: /Yêu thích/ }).click()
    await expect(page.getByRole('button', { name: /Yêu thích/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(grateful).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByText('2 lượt bày tỏ cảm xúc')).toBeVisible()
    await expect(page.getByRole('button', { name: /Yêu thích/ })).toHaveAttribute('aria-pressed', 'true')

    // Bấm lại thì bỏ
    await page.getByRole('button', { name: /Yêu thích/ }).click()
    await expect(page.getByText('1 lượt bày tỏ cảm xúc')).toBeVisible()

    const admin = await otherMachine(browser, info)
    try {
      await login(admin, 'admin@demo.local', '/admin/cuoc-thi')
      await expect(admin.getByRole('heading', { name: 'Cuộc thi', level: 1 })).toBeVisible()
      const firstRow = admin.getByRole('row').nth(1)
      await expect(firstRow).toContainText('Người lái đò thầm lặng')
      await expect(firstRow).toContainText('Trần Ngọc Hân · Lớp 9A1')
      const download = admin.waitForEvent('download')
      await admin.getByRole('button', { name: 'Tải file Excel (CSV)' }).click()
      expect((await download).suggestedFilename()).toBe('xep-hang-ky-niem-thay-co-2026.csv')
    } finally {
      await admin.context().close()
    }
  })

  test('hết hạn bình chọn thì khóa nút', async ({ page }) => {
    await sql(`update public.contests set vote_ends_at = now() - interval '1 minute' where id = $1`, [
      CONTEST_ID,
    ])
    try {
      await login(page, 'editor@demo.local', '/tin-tuc/nguoi-lai-do-tham-lang')
      await expect(page.getByText('Đã hết hạn bình chọn')).toBeVisible()
      await expect(page.getByRole('button', { name: /Thích/ }).first()).toBeDisabled()
    } finally {
      await sql(`update public.contests set vote_ends_at = now() + interval '30 days' where id = $1`, [
        CONTEST_ID,
      ])
    }
  })
})
