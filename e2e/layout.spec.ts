import { expect, test, type Page } from '@playwright/test'
import { sql } from './db.ts'
import { login, otherMachine, screenshotPath } from './helpers.ts'

/**
 * Giai đoạn 8.5: bố cục trang chủ theo vùng + kiểu hiển thị. Nghiệm thu: đổi trong quản trị, khách thấy ngay;
 * cấu hình cũ vẫn đọc được và không đổi giao diện. Cấu hình bị đổi được khôi phục sau mỗi test.
 */
const C2 = '00000000-0000-0000-0000-0000000000c2'
const C4 = '00000000-0000-0000-0000-0000000000c4'

let saved: unknown

test.beforeEach(async () => {
  const rows = await sql<{ value: unknown }>(`select value from public.site_settings where key = 'homepage'`)
  saved = rows[0]!.value
})

test.afterEach(async () => {
  await sql(`update public.site_settings set value = $1 where key = 'homepage'`, [JSON.stringify(saved)])
})

function setHomepage(value: unknown) {
  return sql(`update public.site_settings set value = $1 where key = 'homepage'`, [JSON.stringify(value)])
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Khối có tiêu đề cấp 2 đúng tên trong vùng nội dung. */
function block(page: Page, title: string) {
  return page.locator('main section').filter({ has: page.getByRole('heading', { name: title, level: 2 }) })
}

test.describe('Khách xem trang chủ', () => {
  test('cấu hình cũ vẫn đọc được: đúng thứ tự, từng chuyên mục một khối, không có phần mới', async ({
    page,
  }, info) => {
    await setHomepage({
      show_slides: true,
      slide_interval: 6,
      sections: [
        { key: 'featured_news', enabled: true, title: 'Tin nổi bật', limit: 5 },
        { key: 'latest_news', enabled: true, title: 'Tin mới nhất', limit: 6 },
        { key: 'category_news', enabled: true, title: '', limit: 4 },
        { key: 'albums', enabled: true, title: 'Thư viện ảnh', limit: 4 },
        { key: 'announcements', enabled: true, title: 'Thông báo', limit: 5 },
        { key: 'documents', enabled: true, title: 'Văn bản mới', limit: 5 },
        { key: 'visit_counter', enabled: true, title: 'Thống kê truy cập', limit: 0 },
      ],
      category_ids: [C2, C4],
      visit_counter_offset: 0,
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Chuyên môn', level: 2 })).toBeVisible()
    const headings = await page.locator('main h2:not([aria-roledescription="carousel"] h2)').allTextContents()
    expect(headings).toEqual([
      'Tin nổi bật',
      'Tin mới nhất',
      'Hoạt động Đoàn - Đội',
      'Chuyên môn',
      'Thư viện ảnh',
      'Thông báo',
      'Văn bản mới',
      'Thống kê truy cập',
    ])
    await expect(page.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Lối tắt' })).toHaveCount(0)
    await noHorizontalScroll(page)
    await page.screenshot({ path: screenshotPath('layout-legacy', info), fullPage: true })
  })

  for (const variant of ['spotlight', 'magazine', 'grid', 'image_list', 'compact']) {
    test(`kiểu ${variant} hiện đúng ở mọi vùng, không cuộn ngang`, async ({ page }, info) => {
      await setHomepage({
        ...(saved as object),
        hero: 'split',
        sections: [
          { key: 'featured_news', zone: 'top', variant, limit: 5 },
          { key: 'latest_news', zone: 'main', variant, columns: 3, limit: 6 },
          { key: 'category_news', zone: 'main', half: true, variant, category_id: C2, limit: 4 },
          { key: 'category_news', zone: 'main', half: true, variant, category_id: C4, limit: 4 },
          { key: 'announcements', zone: 'bottom', half: true },
          { key: 'documents', zone: 'bottom', half: true },
          { key: 'visit_counter', zone: 'sidebar' },
          { key: 'topic_banner', enabled: false },
          { key: 'albums', zone: 'bottom', columns: 4 },
        ],
      })
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Chuyên môn', level: 2 })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toBeVisible()
      await noHorizontalScroll(page)
      // Kiểu gọn không có ảnh; các kiểu khác có
      const images = block(page, 'Tin mới nhất').locator('img')
      if (variant === 'compact') await expect(images).toHaveCount(0)
      else await expect(images.first()).toBeAttached()
      await page.screenshot({ path: screenshotPath(`layout-${variant}`, info), fullPage: true })
    })
  }

  test('hai khối nửa trang: song song trên máy tính, một cột trên điện thoại; khối lẻ chiếm cả hàng', async ({
    page,
    isMobile,
  }) => {
    await setHomepage({
      ...(saved as object),
      sections: [
        { key: 'category_news', zone: 'main', half: true, variant: 'compact', category_id: C2 },
        { key: 'category_news', zone: 'main', half: true, variant: 'compact', category_id: C4 },
        // Chuyên mục không tồn tại: khối tự ẩn, khối còn lại chiếm cả hàng
        {
          key: 'category_news',
          zone: 'bottom',
          half: true,
          variant: 'compact',
          category_id: '00000000-0000-0000-0000-00000000dead',
        },
        { key: 'latest_news', zone: 'bottom', half: true, variant: 'compact', limit: 3 },
      ],
    })
    await page.goto('/')
    const left = page.getByRole('heading', { name: 'Hoạt động Đoàn - Đội', level: 2 })
    const right = page.getByRole('heading', { name: 'Chuyên môn', level: 2 })
    await expect(right).toBeVisible()
    const [a, b] = [(await left.boundingBox())!, (await right.boundingBox())!]
    if (isMobile) expect(b.y).toBeGreaterThan(a.y)
    else expect(Math.abs(b.y - a.y)).toBeLessThan(2)

    const latest = block(page, 'Tin mới nhất')
    await expect(latest).toBeVisible()
    const width = (await latest.boundingBox())!.width
    const main = (await page.locator('main').boundingBox())!.width
    expect(width).toBeGreaterThan(main * 0.8)
    await noHorizontalScroll(page)
  })

  test('khối Lối tắt: có icon và liên kết, mục của module đang tắt tự ẩn', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Lối tắt' })
    await expect(nav.getByRole('link', { name: 'Văn bản' })).toHaveAttribute('href', '/van-ban')
    await expect(nav.getByRole('link')).toHaveCount(4)
    await noHorizontalScroll(page)

    await sql(`update public.module_settings set is_enabled = false where module_key = 'documents'`)
    try {
      await page.reload()
      await expect(nav.getByRole('link', { name: 'Thông báo' })).toBeVisible()
      await expect(nav.getByRole('link')).toHaveCount(3)
    } finally {
      await sql(`update public.module_settings set is_enabled = true where module_key = 'documents'`)
    }
  })
})

test.describe('Quản trị bố cục', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng quản trị kiểm tra trên desktop')

  test('đổi kiểu, đầu trang, vùng: chỉ khi lưu khách mới thấy; xem trước không ghi CSDL', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000)
    await login(page, 'admin@demo.local', '/admin/trang-chu?tab=bo-cuc')
    const guest = await otherMachine(browser, info)
    await guest.goto('/')
    await expect(guest.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toBeVisible()
    await expect(block(guest, 'Tin mới nhất').locator('img').first()).toBeAttached()

    await page.getByRole('radio', { name: 'Danh sách gọn cho khối Tin mới nhất' }).check({ force: true })
    await page.getByRole('radio', { name: 'Kiểu đầu trang: Slide toàn rộng' }).check({ force: true })
    await page.getByRole('radio', { name: 'Tiêu đề khối: Gạch chân' }).check({ force: true })
    await page.getByLabel('Vùng của khối Thư viện ảnh').selectOption('main')
    await expect(page.getByRole('img', { name: 'Sơ đồ bố cục' })).toContainText('Danh sách gọn')
    await page.screenshot({ path: screenshotPath('admin-layout', info), fullPage: true })

    // Xem trước: tab mới thấy bản nháp, khách chưa thấy
    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
    const popup = await popupPromise
    await expect(popup.getByText('Bản xem trước bố cục, chưa lưu')).toBeVisible()
    await expect(popup.getByRole('heading', { name: 'Tin mới nhất', level: 2 })).toBeVisible()
    await expect(popup.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toHaveCount(0)
    await popup.close()
    await guest.reload()
    await expect(guest.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toBeVisible()

    await page.getByRole('button', { name: 'Lưu bố cục' }).click()
    await expect(page.getByText('Đã lưu bố cục. Trang chủ đã cập nhật.')).toBeVisible()

    await guest.reload()
    await expect(guest.getByRole('heading', { name: 'Tin mới nhất', level: 2 })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Tiêu điểm', level: 2 })).toHaveCount(0)
    await expect(block(guest, 'Tin mới nhất').locator('img')).toHaveCount(0)
    await guest.screenshot({ path: screenshotPath('layout-after-admin', info), fullPage: true })
    await guest.context().close()
  })

  test('mẫu bố cục hỏi xác nhận, hủy thì không đổi, thêm và bỏ khối chuyên mục', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000)
    await login(page, 'admin@demo.local', '/admin/trang-chu?tab=bo-cuc')
    await expect(page.getByLabel('Vùng của khối Thông báo')).toHaveValue('sidebar')

    page.once('dialog', (d) => void d.dismiss())
    await page.getByRole('button', { name: /^Nhiều ảnh/ }).click()
    await expect(page.getByLabel('Vùng của khối Thông báo')).toHaveValue('sidebar')

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: /^Nhiều ảnh/ }).click()
    await expect(page.getByLabel('Vùng của khối Thông báo')).toHaveValue('bottom')

    await page.getByRole('button', { name: 'Tin nhà trường' }).click()
    await expect(page.getByLabel('Vùng của khối Chuyên mục Tin nhà trường')).toHaveValue('main')
    await page.getByRole('button', { name: 'Bỏ khối Chuyên mục Chuyên môn' }).click()
    await expect(page.getByLabel('Vùng của khối Chuyên mục Chuyên môn')).toHaveCount(0)

    await page.getByRole('button', { name: 'Lưu bố cục' }).click()
    await expect(page.getByText('Đã lưu bố cục. Trang chủ đã cập nhật.')).toBeVisible()

    const guest = await otherMachine(browser, info)
    await guest.goto('/')
    await expect(guest.getByRole('heading', { name: 'Tin nhà trường', level: 2 })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Chuyên môn', level: 2 })).toHaveCount(0)
    // Mẫu Nhiều ảnh không có cột phải
    await expect(guest.locator('main aside')).toHaveCount(0)
    await guest.context().close()
  })

  test('kiểu trang Tin tức: khách thấy ngay, lưu Bố cục không làm mất; biên tập viên không thấy', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000)
    await login(page, 'admin@demo.local', '/admin/tin-tuc')
    await page.getByRole('button', { name: 'Lưới', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Lưới', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const guest = await otherMachine(browser, info)
    await guest.goto('/tin-tuc')
    const article = guest.locator('main article').first()
    await expect(article).toBeVisible()
    const first = (await article.boundingBox())!
    const second = (await guest.locator('main article').nth(1).boundingBox())!
    expect(Math.abs(first.y - second.y)).toBeLessThan(2)
    await noHorizontalScroll(guest)
    await guest.screenshot({ path: screenshotPath('news-grid', info), fullPage: true })

    await page.goto('/admin/trang-chu?tab=bo-cuc')
    await page.getByRole('button', { name: 'Lưu bố cục' }).click()
    await expect(page.getByText('Đã lưu bố cục. Trang chủ đã cập nhật.')).toBeVisible()
    await guest.reload()
    await expect(guest.locator('main article').first()).toBeVisible()
    const again = (await guest.locator('main article').nth(1).boundingBox())!
    expect(Math.abs(first.y - again.y)).toBeLessThan(2)
    await guest.context().close()

    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await login(page, 'editor@demo.local', '/admin/tin-tuc')
    await expect(page.getByRole('heading', { name: 'Tin tức' })).toBeVisible()
    await expect(page.getByText('Kiểu trang Tin tức công khai')).toHaveCount(0)
  })

  test('sửa menu Lối tắt trong trang Menu: khách thấy ngay', async ({ page, browser }, info) => {
    await login(page, 'admin@demo.local', '/admin/menu')
    await page.getByRole('tab', { name: 'Lối tắt trang chủ' }).click()
    await page.getByRole('button', { name: 'Thêm mục menu' }).click()
    await page.getByLabel('Tên hiển thị').fill('E2E Liên hệ')
    await page.getByLabel('Đường dẫn').fill('/trang/lien-he')
    await page.getByRole('button', { name: 'Thêm mục', exact: true }).click()
    await expect(page.getByText('E2E Liên hệ')).toBeVisible()
    try {
      const guest = await otherMachine(browser, info)
      await guest.goto('/')
      await expect(
        guest.getByRole('navigation', { name: 'Lối tắt' }).getByRole('link', { name: 'E2E Liên hệ' }),
      ).toBeVisible()
      await guest.context().close()
    } finally {
      await sql(`delete from public.menu_items where title like 'E2E %'`)
    }
  })
})
