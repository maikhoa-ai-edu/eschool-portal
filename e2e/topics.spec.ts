import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, otherMachine, screenshotPath } from './helpers.ts'

const TOPIC_PATH = '/chuyen-de/hoc-tap-va-lam-theo-bac'

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('Menu', () => {
  test('menu ngang in hoa, có icon, tiếng Việt đúng dấu', async ({ page, isMobile }, info) => {
    test.skip(isMobile, 'Menu ngang chỉ có trên máy tính')
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Menu chính' })
    const item = nav.getByRole('link', { name: 'Thư viện ảnh' })
    await expect(item).toBeVisible()
    await expect(item).toHaveCSS('text-transform', 'uppercase')
    await expect(item.locator('svg')).toHaveCount(1)
    expect(await item.evaluate((el) => (el as HTMLElement).innerText)).toBe('THƯ VIỆN ẢNH')
    await page.screenshot({
      path: screenshotPath('menu-ngang', info),
      clip: { x: 0, y: 0, width: 1280, height: 260 },
    })
    await noHorizontalScroll(page)
  })

  test('thanh đáy chỉ hiện trên điện thoại, không che chân trang', async ({ page, isMobile }, info) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Menu nhanh' })
    if (!isMobile) {
      await expect(bar).toBeHidden()
      return
    }
    await expect(bar).toBeVisible()
    await expect(bar.getByRole('link')).toHaveCount(5)
    await expect(bar.getByRole('link', { name: 'Trang chủ' })).toHaveClass(/text-primary/)
    await page.screenshot({ path: screenshotPath('thanh-day', info) })

    // Cuộn hết trang: dòng ghi công vẫn nằm trên thanh đáy
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const credit = page.getByText('Thiết kế bởi MVK')
    await expect(credit).toBeInViewport()
    const creditBox = (await credit.boundingBox())!
    const barBox = (await bar.boundingBox())!
    // Hộp của dòng ghi công có đệm dưới 16px (py-4); phần chữ phải nằm trên thanh đáy
    expect(creditBox.y + creditBox.height - 16).toBeLessThanOrEqual(barBox.y)
    await page.screenshot({ path: screenshotPath('thanh-day-chan-trang', info) })
    await noHorizontalScroll(page)

    await bar.getByRole('link', { name: 'Tin tức' }).click()
    await expect(page).toHaveURL(/\/tin-tuc$/)
    await expect(bar.getByRole('link', { name: 'Tin tức' })).toHaveClass(/text-primary/)
  })

  test('thanh đáy không hiện ở trang quản trị và trang đăng nhập', async ({ page }) => {
    await page.goto('/dang-nhap')
    await expect(page.getByRole('navigation', { name: 'Menu nhanh' })).toHaveCount(0)
    await login(page, 'admin@demo.local')
    await expect(page.getByRole('navigation', { name: 'Menu nhanh' })).toHaveCount(0)
  })

  test('chọn icon trong quản trị, thêm mục thanh đáy; tắt module thì ẩn mục', async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'Chạy một lần trên khổ điện thoại')
    test.setTimeout(90_000)
    await sql(`delete from public.menu_items where title like 'E2E %'`)
    await sql(
      `delete from public.menu_items where url = '/trang/lien-he' and menu_id = (select id from public.menus where code = 'mobile')`,
    )
    try {
      await login(page, 'admin@demo.local', '/admin/menu')
      await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible()
      await page.getByRole('tab', { name: 'Thanh đáy điện thoại' }).click()
      await page.getByRole('button', { name: 'Thêm mục menu' }).click()
      await page.getByLabel('Tên hiển thị').fill('E2E Chuyên đề')
      await page.getByLabel('Đường dẫn').fill('/chuyen-de')
      await page.getByRole('radio', { name: 'Ngôi sao' }).check({ force: true })
      await expect(page.getByLabel('Thuộc mục')).toHaveCount(0)
      await page.screenshot({ path: screenshotPath('admin-chon-icon', info) })
      await page.getByRole('button', { name: 'Thêm mục', exact: true }).click()
      await expect(page.getByText('E2E Chuyên đề')).toBeVisible()

      const guest = await otherMachine(browser, info)
      await guest.goto('/')
      const bar = guest.getByRole('navigation', { name: 'Menu nhanh' })
      await expect(bar.getByRole('link', { name: 'E2E Chuyên đề' })).toBeVisible()
      await guest.context().close()

      await sql(`update public.module_settings set is_enabled = false where module_key = 'topics'`)
      const guest2 = await otherMachine(browser, info)
      await guest2.goto('/')
      const bar2 = guest2.getByRole('navigation', { name: 'Menu nhanh' })
      await expect(bar2.getByRole('link', { name: 'Trang chủ' })).toBeVisible()
      await expect(bar2.getByRole('link', { name: 'E2E Chuyên đề' })).toHaveCount(0)
      await guest2.goto(TOPIC_PATH)
      await expect(guest2.getByRole('heading', { name: 'Học tập và làm theo Bác' })).toHaveCount(0)
      await guest2.context().close()
    } finally {
      await sql(`update public.module_settings set is_enabled = true where module_key = 'topics'`)
      await sql(`delete from public.menu_items where title like 'E2E %'`)
      await sql(`insert into public.menu_items (menu_id, title, url, icon, sort_order)
        select id, 'Liên hệ', '/trang/lien-he', 'phone', 4 from public.menus where code = 'mobile'`)
    }
  })
})

test.describe('Chuyên đề', () => {
  test('trang chuyên đề đủ các khối từ CSDL, không cuộn ngang', async ({ page }, info) => {
    await page.goto(TOPIC_PATH)
    await expect(page.getByRole('heading', { level: 1, name: 'Học tập và làm theo Bác' })).toBeVisible()
    await expect(page.getByText('Non sông Việt Nam')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bài viết chuyên đề' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Hội thi kể chuyện về Bác/ })).toBeVisible()
    await expect(page.getByText('Khiêm tốn, thật thà, dũng cảm')).toBeVisible()
    await expect(page.getByRole('link', { name: /Kế hoạch học tập và làm theo Bác/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hình ảnh hoạt động' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Phim tư liệu' })).toHaveCount(0)
    await expect(page.locator('img[src*="album"]').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: screenshotPath('chuyen-de', info), fullPage: true })
    await noHorizontalScroll(page)
  })

  test('/chuyen-de có một chuyên đề thì vào thẳng', async ({ page }) => {
    await page.goto('/chuyen-de')
    await expect(page).toHaveURL(new RegExp(`${TOPIC_PATH}$`))
  })

  test('tạo chuyên đề nháp: khách không thấy, đăng rồi thì thấy', async ({ page, browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'Luồng quản trị chạy một lần')
    test.setTimeout(90_000)
    await sql(`delete from public.topics where title like 'E2E %'`)
    try {
      await login(page, 'admin@demo.local', '/admin/chuyen-de/moi')
      await expect(page.getByRole('heading', { name: 'Thêm chuyên đề' })).toBeVisible()
      await page.getByLabel('Tiêu đề', { exact: true }).fill('E2E An toàn giao thông')
      await page.getByLabel('Màu nền đầu trang').fill('#0F766E')
      await page.getByLabel('Loại khối mới').selectOption('quote')
      await page.getByRole('button', { name: 'Thêm khối' }).click()
      await page.getByLabel('Lời trích', { exact: true }).fill('E2E Đi đường an toàn')
      await page.getByRole('button', { name: 'Lưu chuyên đề' }).click()
      await expect(page.getByText('Đã lưu chuyên đề.')).toBeVisible()
      await page.screenshot({ path: screenshotPath('admin-chuyen-de', info) })

      const guest = await otherMachine(browser, info)
      await guest.goto('/chuyen-de/e2e-an-toan-giao-thong')
      await expect(guest.getByRole('heading', { name: 'E2E An toàn giao thông' })).toHaveCount(0)

      // Nhân sự xem trước bản nháp
      await page.goto('/chuyen-de/e2e-an-toan-giao-thong')
      await expect(page.getByText('Bản xem trước')).toBeVisible()

      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Sửa chuyên đề' })).toBeVisible()
      await page.getByLabel('Trạng thái').selectOption('published')
      await page.getByRole('button', { name: 'Lưu chuyên đề' }).click()
      await expect(page.getByText('Đã lưu chuyên đề.')).toBeVisible()

      await guest.reload()
      await expect(guest.getByRole('heading', { name: 'E2E An toàn giao thông' })).toBeVisible()
      await expect(guest.getByText('E2E Đi đường an toàn')).toBeVisible()
      // Có từ hai chuyên đề thì /chuyen-de là danh sách
      await guest.goto('/chuyen-de')
      await expect(guest.getByRole('heading', { name: 'Chuyên đề', level: 1 })).toBeVisible()
      await guest.context().close()
    } finally {
      await sql(`delete from public.topics where title like 'E2E %'`)
    }
  })
})

test.describe('Banner trang chủ', () => {
  test('banner dẫn tới chuyên đề', async ({ page }, info) => {
    await page.goto('/')
    const banner = page.getByRole('link', { name: /Khám phá chuyên đề/ })
    await expect(banner).toBeVisible()
    await page.screenshot({ path: screenshotPath('banner', info) })
    await banner.click()
    await expect(page).toHaveURL(new RegExp(`${TOPIC_PATH}$`))
    await noHorizontalScroll(page)
  })

  test('đổi vị trí, liên kết và tắt banner trong quản trị', async ({ page, browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'Luồng quản trị chạy một lần')
    test.setTimeout(90_000)
    const saved = await sql<{ value: unknown }>(
      `select value from public.site_settings where key = 'homepage'`,
    )
    try {
      await login(page, 'admin@demo.local', '/admin/trang-chu')
      await page.getByRole('tab', { name: 'Bố cục' }).click()
      await expect(page.getByLabel('Liên kết khi bấm')).toBeVisible()
      await page.getByLabel('Vị trí').selectOption('column')
      await page.getByLabel('Liên kết khi bấm').fill('/tin-tuc')
      await page.getByRole('button', { name: 'Chuyển khối Banner chuyên đề xuống' }).click()
      await page.getByRole('button', { name: 'Lưu bố cục' }).click()
      await expect(page.getByText('Đã lưu bố cục')).toBeVisible()
      await page.screenshot({ path: screenshotPath('admin-banner', info) })

      const guest = await otherMachine(browser, info)
      await guest.goto('/')
      const banner = guest.getByRole('link', { name: /Khám phá chuyên đề/ })
      await expect(banner).toHaveAttribute('href', '/tin-tuc')
      // Sau khối Tin nổi bật, trong cột chính
      const featured = guest.getByRole('heading', { name: 'Tin nổi bật' })
      await expect(featured).toBeVisible()
      expect((await banner.boundingBox())!.y).toBeGreaterThan((await featured.boundingBox())!.y)

      await page.getByRole('checkbox', { name: 'Banner chuyên đề' }).uncheck()
      await page.getByRole('button', { name: 'Lưu bố cục' }).click()
      await expect(page.getByText('Đã lưu bố cục')).toBeVisible()
      await guest.reload()
      await expect(guest.getByRole('heading', { name: 'Tin nổi bật' })).toBeVisible()
      await expect(guest.getByRole('link', { name: /Khám phá chuyên đề/ })).toHaveCount(0)
      await guest.context().close()
    } finally {
      await sql(`update public.site_settings set value = $1 where key = 'homepage'`, [
        JSON.stringify(saved[0]!.value),
      ])
    }
  })
})
