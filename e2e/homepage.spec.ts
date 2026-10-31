import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, makePng, otherMachine, screenshotPath, uniqueSuffix } from './helpers.ts'

/**
 * Giai đoạn 5: trang chủ & cấu hình. Nghiệm thu: mọi chỉnh sửa trong trang quản trị hiện ra trang công khai
 * (kiểm tra bằng một trình duyệt khách riêng). Cấu hình bị đổi được khôi phục sau mỗi test.
 */
let snapshot: Array<{ key: string; value: unknown }> = []
let modules: Array<{ module_key: string; is_enabled: boolean }> = []

test.beforeEach(async () => {
  snapshot = await sql('select key, value from public.site_settings')
  modules = await sql('select module_key, is_enabled from public.module_settings')
})

test.afterEach(async () => {
  for (const s of snapshot) {
    await sql('update public.site_settings set value = $2 where key = $1', [s.key, JSON.stringify(s.value)])
  }
  for (const m of modules) {
    await sql('update public.module_settings set is_enabled = $2 where module_key = $1', [
      m.module_key,
      m.is_enabled,
    ])
  }
  await sql("delete from public.homepage_slides where title like 'E2E %'")
})

test.describe('Trang chủ công khai', () => {
  test('slide, tin nổi bật, thông báo, văn bản, thư viện ảnh và bộ đếm từ dữ liệu mẫu', async ({
    page,
  }, info) => {
    await page.goto('/')
    const slider = page.getByRole('region', { name: 'Ảnh nổi bật' })
    await expect(slider.getByRole('heading', { name: 'Chào mừng năm học mới 2026 - 2027' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tin nổi bật', level: 2 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Câu lạc bộ STEM ra mắt mô hình/ }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Thông báo', level: 2 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Kế hoạch thực hiện nhiệm vụ năm học/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Học tập và trải nghiệm sáng tạo/ })).toBeVisible()
    await expect(page.getByText('Tổng lượt truy cập')).toBeVisible()
    // Logo của trường lấy từ Storage (dữ liệu mẫu)
    await expect(page.getByRole('img', { name: /^Logo Trường/ }).first()).toHaveAttribute(
      'src',
      /seed\/logo\.jpg$/,
    )
    await page.screenshot({ path: screenshotPath('home', info), fullPage: true })

    // Chuyển slide bằng nút
    await slider.getByRole('button', { name: 'Tạm dừng tự chạy' }).click()
    await slider.getByRole('button', { name: 'Ảnh sau' }).click()
    await expect(slider.getByRole('group', { name: /^2\/4/ })).toBeVisible()
  })
})

test.describe('Quản trị trang chủ & cấu hình', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng quản trị kiểm tra trên desktop')

  test('thêm slide có ảnh, sắp xếp khối, dòng chữ chạy, số khởi điểm: khách thấy ngay', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000)
    const title = `E2E Hội khỏe Phù Đổng ${uniqueSuffix()}`
    await login(page, 'admin@demo.local', '/admin/trang-chu')

    // Slide mới, đưa lên đầu
    await page.getByRole('button', { name: 'Thêm slide' }).click()
    await page.getByLabel('Ảnh slide').setInputFiles({
      name: 'hoi-khoe.png',
      mimeType: 'image/png',
      buffer: makePng(800, 450, [0, 43, 102]),
    })
    await expect(page.getByRole('button', { name: 'Đổi ảnh' })).toBeVisible()
    await page.getByLabel('Tiêu đề trên slide').fill(title)
    await page.getByLabel(/Liên kết nút/).fill('/tin-tuc')
    await page.getByRole('button', { name: 'Thêm slide', exact: true }).last().click()
    await expect(page.getByText(title)).toBeVisible()
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: `Chuyển "${title}" lên` }).click()
    await expect(page.getByRole('button', { name: `Chuyển "${title}" lên` })).toBeDisabled()
    await page.screenshot({ path: screenshotPath('admin-homepage-slides', info) })

    // Bố cục: tắt Thư viện ảnh, đổi tên khối Thông báo
    await page.getByRole('tab', { name: 'Bố cục' }).click()
    await page.getByRole('checkbox', { name: 'Thư viện ảnh', exact: true }).uncheck()
    await page.getByLabel('Tiêu đề khối Thông báo', { exact: true }).fill('Bảng tin nhà trường')
    await page.getByRole('button', { name: 'Chuyển khối Tin mới nhất lên' }).click()
    await page.screenshot({ path: screenshotPath('admin-homepage-layout', info) })
    await page.getByRole('button', { name: 'Lưu bố cục' }).click()
    await expect(page.getByText('Đã lưu bố cục. Trang chủ đã cập nhật.')).toBeVisible()

    // Dòng chữ chạy
    await page.getByRole('tab', { name: 'Dòng chữ chạy' }).click()
    await page.getByRole('button', { name: 'Thêm dòng' }).click()
    await page.getByLabel('Nội dung dòng 4').fill('E2E Đăng ký Hội khỏe Phù Đổng')
    await page.getByLabel('Liên kết dòng 4').fill('/thong-bao')
    await page.getByRole('button', { name: 'Lưu dòng chữ chạy' }).click()
    await expect(page.getByText('Đã lưu dòng chữ chạy.')).toBeVisible()

    // Số khởi điểm bộ đếm
    await page.getByRole('tab', { name: 'Bộ đếm truy cập' }).click()
    await page.getByLabel('Cộng thêm vào tổng lượt truy cập').fill('125000')
    await page.getByRole('button', { name: 'Lưu số khởi điểm' }).click()
    await expect(page.getByText('Đã lưu số khởi điểm.')).toBeVisible()

    // Máy khách
    const guest = await otherMachine(browser, info)
    await guest.goto('/')
    const slider = guest.getByRole('region', { name: 'Ảnh nổi bật' })
    await expect(slider.getByRole('group', { name: new RegExp(`^1/5: ${title}`) })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Bảng tin nhà trường' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: 'Thư viện ảnh', level: 2 })).toHaveCount(0)
    const headings = await guest.locator('main h2').allTextContents()
    expect(headings.indexOf('Tin mới nhất')).toBeLessThan(headings.indexOf('Tin nổi bật'))
    await expect(guest.getByRole('link', { name: 'E2E Đăng ký Hội khỏe Phù Đổng' }).first()).toBeVisible()
    await expect(guest.getByText(/1[23]\d\.\d{3}/).first()).toBeVisible()
    await guest.screenshot({ path: screenshotPath('home-after-admin', info), fullPage: true })
  })

  test('quản trị cấp cao sửa thông tin trường, màu sắc và tắt module: khách thấy ngay', async ({
    page,
    browser,
  }, info) => {
    await login(page, 'superadmin@demo.local', '/admin/cai-dat')
    await page.getByLabel('Điện thoại').fill('0296 3 888 999')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Đã lưu. Trang công khai đã cập nhật.')).toBeVisible()

    await page.goto('/admin/nhan-dien')
    await expect(page.getByLabel('Ảnh nền đầu trang (banner)')).toBeAttached()
    await page.getByRole('textbox', { name: 'Màu chủ đạo' }).fill('#7F1D1D')
    await page.screenshot({ path: screenshotPath('admin-branding', info) })
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Đã lưu. Trang công khai đã cập nhật.')).toBeVisible()

    await page.goto('/admin/module')
    await page.getByRole('checkbox', { name: /Thư viện ảnh/ }).uncheck()
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Đã lưu. Trang công khai đã cập nhật.')).toBeVisible()
    // Menu quản trị ẩn ngay mục của module vừa tắt
    await expect(
      page.getByRole('navigation', { name: 'Menu quản trị' }).getByRole('link', { name: 'Thư viện ảnh' }),
    ).toHaveCount(0)

    const guest = await otherMachine(browser, info)
    await guest.goto('/')
    await expect(guest.getByRole('link', { name: '0296 3 888 999' })).toBeVisible()
    const primary = await guest.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim(),
    )
    expect(primary.toUpperCase()).toBe('#7F1D1D')
    await expect(
      guest.getByRole('navigation', { name: 'Menu chính' }).getByRole('link', { name: 'Thư viện ảnh' }),
    ).toHaveCount(0)
    await guest.screenshot({ path: screenshotPath('home-recolored', info) })
  })

  test('biên tập viên không vào được trang chủ & cấu hình; quản trị nội dung không vào được cấu hình trường', async ({
    page,
  }) => {
    await login(page, 'editor@demo.local')
    await page.goto('/admin/trang-chu')
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await login(page, 'admin@demo.local')
    for (const path of ['/admin/cai-dat', '/admin/nhan-dien', '/admin/module']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    }
  })
})
