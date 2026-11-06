import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, uniqueSuffix } from './helpers.ts'

/** Bản 0.13.0: chấm đỏ việc đang chờ, chân trang quản trị, nút lên đầu trang, tự đăng xuất. */
test.describe.configure({ mode: 'serial' })

const CATEGORY = '00000000-0000-0000-0000-0000000000c1'
const AUTHOR = '00000000-0000-0000-0000-0000000000a2'

async function count(query: string): Promise<number> {
  const [row] = await sql<{ n: string }>(query)
  return Number(row!.n)
}

test.afterEach(async () => {
  await sql(`delete from public.news where title like 'E2E chấm đỏ %'`)
})

test('chấm đỏ ở menu và chuông báo bài, bình luận chờ duyệt; chân trang quản trị', async ({ page }, info) => {
  test.skip(info.project.use.isMobile === true, 'Menu bên trái kiểm tra trên desktop')
  const pendingNews = await count(`select count(*) as n from public.news where status = 'pending'`)
  const pendingComments = await count(`select count(*) as n from public.news_comments where status = 'pending'`)

  await login(page, 'admin@demo.local')
  const nav = page.getByRole('navigation', { name: 'Menu quản trị' })
  const newsLink = nav.getByRole('link', { name: /^Tin tức/ })
  await expect(newsLink).toContainText(String(pendingNews))
  await expect(nav.getByRole('link', { name: /^Bình luận/ })).toContainText(String(pendingComments))

  const bell = page.getByRole('button', { name: /^Thông báo/ })
  await expect(bell).toHaveAccessibleName(`Thông báo, ${pendingNews + pendingComments} việc đang chờ`)
  await bell.click()
  await page.getByRole('link', { name: `${pendingNews} bài đang chờ duyệt` }).click()
  await expect(page).toHaveURL(/\/admin\/tin-tuc\?trang-thai=pending/)

  // Có bài mới gửi duyệt: chuyển trang là số trên chấm đổi, không cần tải lại
  await sql(
    `insert into public.news (title, slug, content, category_id, author_id, status)
     values ('E2E chấm đỏ gửi duyệt', $1, '<p>x</p>', $2, $3, 'pending')`,
    [`e2e-cham-do-${uniqueSuffix()}`, CATEGORY, AUTHOR],
  )
  await nav.getByRole('link', { name: /^Bảng điều khiển/ }).click()
  await expect(newsLink).toContainText(String(pendingNews + 1))

  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('eSchool Portal')
  await expect(footer).toContainText(`Phiên bản ${process.env.npm_package_version ?? '0.13.0'}`)
  await expect(footer).toContainText('CSDL 0.14.0')
  await expect(footer).toContainText('Thiết kế bởi MVK')
})

test('nút lên đầu trang hiện khi kéo xuống, không che thanh menu đáy', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Lên đầu trang' })
  await expect(button).toBeHidden()
  // Khối cuối trang dựng dần khi cuộn tới nên cuộn lại tới khi trang đủ dài
  await expect
    .poll(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      return button.isVisible()
    })
    .toBe(true)

  const bar = page.getByRole('navigation', { name: 'Menu nhanh' })
  if (await bar.isVisible()) {
    const [buttonBox, barBox] = [await button.boundingBox(), await bar.boundingBox()]
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(barBox!.y)
  }

  await button.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(button).toBeHidden()
})

test('không thao tác 60 phút thì báo trước rồi tự đăng xuất', async ({ page }, info) => {
  test.skip(info.project.use.isMobile === true, 'Luồng quản trị kiểm tra trên desktop')
  await page.clock.install()
  await login(page, 'editor@demo.local')
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible()

  await page.clock.fastForward('58:30')
  const dialog = page.getByRole('alertdialog', { name: 'Bạn vẫn đang làm việc chứ?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Tiếp tục làm việc' }).click()
  await expect(dialog).toBeHidden()

  // Bấm Tiếp tục thì tính lại từ đầu: thêm 50 phút vẫn còn phiên
  await page.clock.fastForward('50:00')
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible()

  await page.clock.fastForward('11:00')
  await expect(page).toHaveURL(/\/dang-nhap/)
  await expect(page.getByText('đăng xuất vì không thao tác')).toBeVisible()
})

test('tắt máy rồi mở lại sau 12 giờ thì phải đăng nhập lại', async ({ page }, info) => {
  test.skip(info.project.use.isMobile === true, 'Luồng quản trị kiểm tra trên desktop')
  await page.clock.install()
  await login(page, 'editor@demo.local')
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible()

  // Đóng trang, đồng hồ chạy qua đêm, sáng hôm sau mở lại
  await page.goto('about:blank')
  await page.clock.fastForward('13:00:00')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/dang-nhap/)
  await expect(page.getByText('Phiên đăng nhập đã hết hạn')).toBeVisible()
})
