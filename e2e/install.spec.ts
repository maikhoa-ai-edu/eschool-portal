import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { INSTALL_CODE, INSTALLER_EMAIL, localSupabase, resetToFreshInstall, restoreSeed, sql } from './db.ts'

/** Dev server không có cấu hình kết nối (xem playwright.config.ts) */
const FRESH = 'http://localhost:3001'
const SCREENS = 'test-results/screens'

const SERVICE_ROLE_LIKE =
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') +
  '.chuky'

test.describe.configure({ mode: 'serial' })

let snapshot: Awaited<ReturnType<typeof resetToFreshInstall>>

test.beforeAll(async () => {
  snapshot = await resetToFreshInstall()
})

test.afterAll(async () => {
  if (snapshot) await restoreSeed(snapshot)
})

/** Tạo logo PNG ngay trong trình duyệt (bucket không nhận SVG). */
async function makeLogo(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const g = canvas.getContext('2d')!
    g.fillStyle = '#14532D'
    g.beginPath()
    g.arc(64, 64, 62, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#FACC15'
    g.font = 'bold 54px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('KT', 64, 68)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return Buffer.from(base64, 'base64')
}

test('CSDL chưa cài xong thì trang chủ và trang đăng nhập dẫn về trình cài đặt', async ({ page }) => {
  // Cổng 3000 đã có cấu hình (.env.local) nên trình cài đặt bỏ qua bước 1–4
  await page.goto('/')
  await expect(page).toHaveURL(/\/install$/)
  await expect(page.getByRole('heading', { name: 'Tạo quản trị viên' })).toBeVisible()
  await page.goto('/dang-nhap')
  await expect(page).toHaveURL(/\/install$/)
})

test('màn hình chào mừng trên điện thoại', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto(`${FRESH}/install`)
  await expect(page.getByRole('heading', { name: 'Chào mừng đến với eSchool Portal' })).toBeVisible()
  await expect(page.getByText('Bước 1: Kiểm tra môi trường')).toBeVisible()
  await expect(page.getByText('Thiết kế bởi MVK')).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-1-mobile.png`, fullPage: true })
})

test('cài đặt từ đầu đến khi vào trang quản trị', async ({ page }) => {
  test.setTimeout(120_000)
  const supabase = localSupabase()

  // Đường dẫn bất kỳ của website chưa cấu hình đều về /install
  await page.goto(`${FRESH}/admin`)
  await expect(page).toHaveURL(/\/install$/)

  // Bước 1
  await expect(page.getByRole('heading', { name: 'Chào mừng đến với eSchool Portal' })).toBeVisible()
  await expect(page.getByText('Website đang chạy qua HTTPS.')).toBeVisible()
  await expect(page.getByText(/Hosting không chạy PHP/)).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-1.png`, fullPage: true })
  await page.getByRole('button', { name: 'Bắt đầu cài đặt' }).click()

  // Bước 2: chặn khóa service_role ngay ở giao diện
  await expect(page.getByRole('heading', { name: 'Kết nối cơ sở dữ liệu Supabase' })).toBeVisible()
  await page.getByLabel('Project URL').fill(`${supabase.url}/rest/v1/`)
  await page.getByLabel('Khóa anon (public)').fill(SERVICE_ROLE_LIKE)
  await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click()
  await expect(page.getByText(/Đây là khóa bí mật/)).toBeVisible()

  // Giả lập project mới tinh: chưa có hàm get_schema_version
  const emptyDb = (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PGRST202',
        message: 'Could not find the function public.get_schema_version',
      }),
    })
  await page.route('**/rest/v1/rpc/get_schema_version', emptyDb)

  await page.getByLabel('Khóa anon (public)').fill(supabase.anonKey)
  await page.screenshot({ path: `${SCREENS}/install-2.png`, fullPage: true })
  await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click()

  // Bước 3: install.sql (sinh từ migrations) để dán vào SQL Editor
  await expect(page.getByRole('heading', { name: 'Khởi tạo cơ sở dữ liệu' })).toBeVisible()
  const sqlBox = page.getByLabel('Nội dung install.sql')
  await expect(sqlBox).toHaveValue(/eSchool Portal: install\.sql/)
  await expect(sqlBox).toHaveValue(/select install_code as "Mã cài đặt" from private\.install_state;\s*$/)
  await page.getByRole('button', { name: 'Tôi đã chạy xong, kiểm tra' }).click()
  await expect(page.getByText('Chưa thấy cơ sở dữ liệu')).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-3.png`, fullPage: true })

  // "Chạy" install.sql xong: CSDL thật đã có schema
  await page.unroute('**/rest/v1/rpc/get_schema_version', emptyDb)
  await page.getByRole('button', { name: 'Tôi đã chạy xong, kiểm tra' }).click()

  // Bước 4: hosting không có PHP -> tải config.json về
  await expect(page.getByRole('heading', { name: 'Lưu cấu hình kết nối' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /cPanel/ })).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải config.json' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('config.json')
  expect(JSON.parse(await readFile(await download.path(), 'utf8'))).toEqual({
    supabaseUrl: supabase.url,
    supabaseAnonKey: supabase.anonKey,
  })
  await page.getByRole('button', { name: 'Kiểm tra config.json' }).click()
  await expect(page.getByText(/Chưa thấy config.json đúng/)).toBeVisible()
  await page.getByRole('tab', { name: 'Vercel' }).click()
  await expect(page.getByText('VITE_SUPABASE_ANON_KEY')).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-4.png`, fullPage: true })
  await page.getByRole('button', { name: 'Để sau, tiếp tục cài đặt →' }).click()

  // Bước 5: tạo tài khoản; nhập sai mã trước
  await expect(page.getByRole('heading', { name: 'Tạo quản trị viên' })).toBeVisible()
  await page.getByLabel('Họ và tên').fill('Nguyễn Văn Hiệu')
  await page.getByLabel('Email').fill(INSTALLER_EMAIL)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('matkhau-an-toan')
  await page.getByLabel('Nhập lại mật khẩu').fill('matkhau-an-toan')
  await page.getByLabel('Mã cài đặt').fill('AAAAAAAAAAAA')
  await page.screenshot({ path: `${SCREENS}/install-5.png`, fullPage: true })
  await page.getByRole('button', { name: 'Tạo tài khoản quản trị' }).click()
  await expect(page.getByRole('heading', { name: 'Nhập mã cài đặt' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('Mã cài đặt không đúng')
  await page.getByLabel('Mã cài đặt').fill(INSTALL_CODE.toLowerCase())
  await page.getByRole('button', { name: 'Xác nhận mã cài đặt' }).click()

  // Bước 6: thông tin trường (CSDL mới chưa có tên trường thật)
  await expect(page.getByRole('heading', { name: 'Thông tin nhà trường' })).toBeVisible()
  await expect(page.getByLabel('Tên trường (đầy đủ)')).toHaveValue('')
  await expect(page.getByLabel('Tên ngắn')).toHaveValue('')
  await page.getByLabel('Tên trường (đầy đủ)').fill('Trường THPT Kiểm Thử')
  await page.getByLabel('Cơ quan chủ quản').fill('Sở Giáo dục và Đào tạo Tỉnh Mẫu')
  await page.getByLabel('Địa chỉ').fill('Số 1 Đường Học, Phường Mẫu')
  await page.getByLabel('Email liên hệ').fill('khong-phai-email')
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click()
  await expect(page.getByText('Email không hợp lệ')).toBeVisible()
  await page.getByLabel('Email liên hệ').fill('lienhe@kiemthu.edu.vn')
  await page.screenshot({ path: `${SCREENS}/install-6.png`, fullPage: true })
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click()

  // Bước 7: logo + bộ màu + khẩu hiệu, xem trước ngay
  await expect(page.getByRole('heading', { name: 'Logo, màu sắc, khẩu hiệu' })).toBeVisible()
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeLogo(page) })
  await expect(page.getByRole('img', { name: 'Logo đã chọn' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Xanh lá' }).click()
  await page.getByLabel('Khẩu hiệu').fill('Kỷ cương - Tình thương - Trách nhiệm')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-primary')))
    .toBe('#14532D')
  await page.screenshot({ path: `${SCREENS}/install-7.png`, fullPage: true })
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click()

  // Bước 8: tắt Thư viện ảnh
  await expect(page.getByRole('heading', { name: 'Chọn module sử dụng' })).toBeVisible()
  await page.getByRole('checkbox', { name: /Thư viện ảnh/ }).uncheck()
  await page.screenshot({ path: `${SCREENS}/install-8.png`, fullPage: true })
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click()

  // Bước 9: tóm tắt + nhắc lưu config.json (đang chạy bằng bản nháp)
  await expect(page.getByRole('heading', { name: 'Hoàn tất cài đặt' })).toBeVisible()
  await expect(page.getByText('Trường THPT Kiểm Thử')).toBeVisible()
  await expect(page.getByText('Tin tức, Thông báo, Văn bản, Trang thông tin')).toBeVisible()
  await expect(page.getByText(INSTALLER_EMAIL)).toBeVisible()
  await expect(page.getByText('Website chưa lưu cấu hình kết nối')).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-9.png`, fullPage: true })
  await page.getByRole('button', { name: 'Hoàn tất và vào trang quản trị' }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Xin chào, Nguyễn Văn Hiệu' })).toBeVisible()
  await page.screenshot({ path: `${SCREENS}/install-done-admin.png`, fullPage: true })

  // Mọi thao tác ghi đã đi qua RLS với vai trò SUPER_ADMIN mới
  const [state] = await sql<{ completed: boolean; code: string | null }>(
    'select completed_at is not null as completed, install_code as code from private.install_state',
  )
  expect(state).toEqual({ completed: true, code: null })
  const [admin] = await sql<{ role: string; full_name: string }>(
    'select role, full_name from public.profiles where email = $1',
    [INSTALLER_EMAIL],
  )
  expect(admin).toEqual({ role: 'SUPER_ADMIN', full_name: 'Nguyễn Văn Hiệu' })
  const [branding] = await sql<{ value: { primary_color: string; logo_url: string } }>(
    "select value from public.site_settings where key = 'branding'",
  )
  expect(branding!.value.primary_color).toBe('#14532D')
  expect(branding!.value.logo_url).toMatch(/\/storage\/v1\/object\/public\/media\/branding\/logo-.+\.png$/)
  const [albums] = await sql<{ is_enabled: boolean }>(
    "select is_enabled from public.module_settings where module_key = 'albums'",
  )
  expect(albums!.is_enabled).toBe(false)

  // Trang công khai hiện thông tin mới; mở lại /install thì không cài lại được
  await page.goto(`${FRESH}/`)
  await expect(page.getByRole('heading', { name: 'Trường THPT Kiểm Thử', level: 1 })).toBeVisible()
  // Module đã tắt thì mục menu tương ứng cũng ẩn
  const nav = page.getByRole('navigation', { name: 'Menu chính' })
  await expect(nav.getByRole('link', { name: 'Tin tức' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Thư viện ảnh' })).toHaveCount(0)
  await page.screenshot({ path: `${SCREENS}/install-done-home.png`, fullPage: true })
  await page.goto(`${FRESH}/install`)
  await expect(page.getByRole('heading', { name: 'Website đã được cài đặt' })).toBeVisible()
})
