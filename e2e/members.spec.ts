import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, PASSWORD, screenshotPath, uniqueSuffix } from './helpers.ts'

/** Giai đoạn 8.6 đợt D: trang đăng nhập, Google trong Thông tin trường, Thành viên, bình luận có duyệt. */
let savedAuth: unknown

test.beforeEach(async () => {
  const [row] = await sql<{ value: unknown }>(
    `select value from public.site_settings where key = 'auth_options'`,
  )
  savedAuth = row!.value
})

test.afterEach(async () => {
  await sql(`update public.site_settings set value = $1 where key = 'auth_options'`, [
    JSON.stringify(savedAuth),
  ])
})

test.afterAll(async () => {
  await sql(`delete from public.news_comments where content like 'E2E %'`)
  await sql(`delete from auth.users where email like 'e2e-tv-%'`)
})

function setAuth(value: Record<string, unknown>) {
  return sql(`update public.site_settings set value = $1 where key = 'auth_options'`, [JSON.stringify(value)])
}

test('trang đăng nhập 2 cột; Google tắt hoặc Supabase chưa bật thì không có nút', async ({ page }, info) => {
  await page.goto('/dang-nhap')
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toHaveCount(0)
  await page.screenshot({ path: screenshotPath('login', info), fullPage: true })

  await setAuth({ google_enabled: true })
  await page.goto('/dang-nhap')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toHaveCount(0)
})

test('Google: Supabase đã bật thì hiện nút, bấm chuyển đúng sang authorize; lỗi chưa mời báo rõ', async ({
  page,
}) => {
  await setAuth({ google_enabled: true })
  await page.route('**/auth/v1/settings', (route) => route.fulfill({ json: { external: { google: true } } }))
  await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ body: 'authorize' }))
  await page.goto('/dang-nhap?next=%2Ftin-tuc')
  const request = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Tiếp tục với Google' }).click()
  const url = new URL((await request).url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toContain('/dang-nhap?next=%2Ftin-tuc')

  await page.goto('/dang-nhap?error=server_error&error_description=Database+error+saving+new+user')
  await expect(page.getByText('Email Google này chưa được mời')).toBeVisible()
})

test('tắt tự đăng ký: không có đường đăng ký', async ({ page }) => {
  await page.goto('/dang-ky')
  await expect(page.getByText('Cần có liên kết mời')).toBeVisible()
  await page.goto('/dang-nhap')
  await expect(page.getByRole('link', { name: /Đăng ký thành viên/ })).toHaveCount(0)
})

test('thành viên tự đăng ký, bình luận chờ duyệt, quản trị duyệt thì khách mới thấy', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng dài chỉ chạy trên desktop')
  test.setTimeout(90_000)
  await setAuth({ allow_self_signup: true })
  const email = `e2e-tv-${uniqueSuffix()}@test.local`
  const text = `E2E Bình luận ${uniqueSuffix()}`
  const [news] = await sql<{ slug: string }>(
    `select slug from public.news where status = 'published' order by published_at desc limit 1`,
  )
  const path = `/tin-tuc/${news!.slug}`

  await page.goto('/dang-nhap')
  await page.getByRole('link', { name: /Đăng ký thành viên/ }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Họ và tên').fill('E2E Thành Viên')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD)
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  // Thành viên về trang chủ, thấy tên và nút đăng xuất, không có lối vào quản trị
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('E2E Thành Viên')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Trang quản trị' })).toHaveCount(0)
  const [member] = await sql<{ role: string | null }>(`select role from public.profiles where email = $1`, [
    email,
  ])
  expect(member!.role).toBeNull()

  await page.goto('/admin')
  await expect(page.getByText('Tài khoản chưa được cấp quyền')).toBeVisible()

  await page.goto(path)
  await page.getByLabel('Viết bình luận').fill(text)
  await page.getByRole('button', { name: 'Gửi bình luận' }).click()
  await expect(page.getByText('Bình luận sẽ hiện sau khi được duyệt')).toBeVisible()
  const mine = page.getByRole('listitem').filter({ hasText: text })
  await expect(mine.getByText('Chờ duyệt')).toBeVisible()
  await page.screenshot({ path: screenshotPath('comments', info), fullPage: true })

  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  await guest.goto(`http://localhost:3000${path}`)
  await expect(guest.getByRole('link', { name: 'Đăng nhập để bình luận' })).toBeVisible()
  await expect(guest.getByText(text)).toHaveCount(0)

  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await admin.goto('http://localhost:3000/dang-nhap?next=%2Fadmin%2Fbinh-luan')
  await admin.getByLabel('Email').fill('admin@demo.local')
  await admin.getByLabel('Mật khẩu').fill(PASSWORD)
  await admin.getByRole('button', { name: 'Đăng nhập' }).click()
  const row = admin.getByRole('listitem').filter({ hasText: text })
  await row.getByRole('button', { name: 'Duyệt' }).click()
  await expect(row).toHaveCount(0)
  await adminContext.close()

  await guest.reload()
  await expect(guest.getByText(text)).toBeVisible()
  await guestContext.close()
})

test('Thông tin trường: bật Google hiện hướng dẫn, địa chỉ callback đúng, từ chối Client ID sai', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  await login(page, 'superadmin@demo.local', '/admin/cai-dat')
  await expect(page.getByLabel('Google Client ID')).toHaveCount(0)
  await page.getByLabel('Bật đăng nhập nhanh bằng Google').check()
  await expect(page.getByText(/\/auth\/v1\/callback$/)).toBeVisible()
  await expect(page.getByText('Không dán Client Secret vào website')).toBeVisible()
  await expect(page.getByText('Supabase chưa bật Google')).toBeVisible()
  await page.screenshot({ path: screenshotPath('google-setup', info), fullPage: true })

  await page.getByLabel('Google Client ID').fill('sai-dinh-dang')
  await page.getByRole('button', { name: /Lưu/ }).click()
  await expect(page.getByText('Client ID có dạng')).toBeVisible()

  await page.getByLabel('Google Client ID').fill('123-abc.apps.googleusercontent.com')
  await page.getByRole('button', { name: /Lưu/ }).click()
  await expect(page.getByText('Đã lưu. Trang công khai đã cập nhật.')).toBeVisible()
  const [row] = await sql<{ value: { google_client_id: string; google_enabled: boolean } }>(
    `select value from public.site_settings where key = 'auth_options'`,
  )
  expect(row!.value.google_client_id).toBe('123-abc.apps.googleusercontent.com')
  expect(row!.value.google_enabled).toBe(true)
})
