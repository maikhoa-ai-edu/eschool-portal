import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, PASSWORD, uniqueSuffix } from './helpers.ts'

/** Giai đoạn 8.6: tài khoản theo nhóm, nhân bản, buộc đổi mật khẩu; captcha khi trường bật. */
test.afterAll(async () => {
  await sql(`delete from auth.users where email like 'e2e-nhom-%'`)
})

test('tạo tài khoản Tổ trưởng, nhân bản, buộc đổi mật khẩu rồi thấy đúng quyền', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  test.setTimeout(90_000)
  const email = `e2e-nhom-${uniqueSuffix()}@test.local`
  await login(page, 'superadmin@demo.local', '/admin/tai-khoan')
  await page.getByLabel('Họ tên').fill('E2E Tổ trưởng')
  await page.getByLabel('Email đăng nhập').fill(email)
  await page.getByLabel('Nhóm').selectOption('TO_TRUONG')
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  const password = (await page.getByLabel(`Mật khẩu của ${email}`).textContent())!
  expect(password).toHaveLength(14)

  await page.getByRole('button', { name: 'Nhân bản E2E Tổ trưởng' }).click()
  await expect(page.getByLabel('Nhóm')).toHaveValue('TO_TRUONG')

  const context = await browser.newContext()
  const user = await context.newPage()
  await user.goto('http://localhost:3000/dang-nhap?next=%2Fadmin')
  await user.getByLabel('Email').fill(email)
  await user.getByLabel('Mật khẩu').fill(password)
  await user.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(user).toHaveURL(/\/doi-mat-khau/)
  await expect(user.getByRole('heading', { name: 'Đổi mật khẩu lần đầu' })).toBeVisible()
  await user.goto('http://localhost:3000/admin/ke-hoach')
  await expect(user).toHaveURL(/\/doi-mat-khau/)
  await user.getByLabel('Mật khẩu mới').fill(PASSWORD)
  await user.getByLabel('Nhập lại mật khẩu').fill(PASSWORD)
  await user.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
  await expect(user).toHaveURL(/\/admin$/)

  const nav = user.getByRole('navigation').filter({ hasText: 'Kế hoạch công tác' })
  await expect(nav.getByRole('link', { name: 'Văn bản' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Tài khoản' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Bình luận' })).toHaveCount(0)
  await context.close()

  // Cấp lại mật khẩu: lại bị buộc đổi
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Cấp lại mật khẩu E2E Tổ trưởng' }).first().click()
  await expect(page.getByLabel(`Mật khẩu của ${email}`).first()).not.toHaveText(password)
  const [row] = await sql<{ must_change_password: boolean }>(
    'select must_change_password from public.profiles where email = $1',
    [email],
  )
  expect(row!.must_change_password).toBe(true)
})

test('captcha bật: có ô xác minh, mã được gửi kèm khi đăng nhập; tắt thì không tải mã Cloudflare', async ({
  page,
}) => {
  const scripts: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('challenges.cloudflare.com')) scripts.push(r.url())
  })
  await page.goto('/dang-nhap')
  await expect(page.getByLabel('Email')).toBeVisible()
  expect(scripts).toHaveLength(0)

  const [saved] = await sql<{ value: unknown }>(
    `select value from public.site_settings where key = 'auth_options'`,
  )
  await sql(
    `update public.site_settings set value = value || '{"captcha_enabled": true, "captcha_site_key": "khoa-thu"}' where key = 'auth_options'`,
  )
  try {
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'window.turnstile={render:(el,o)=>{el.textContent="OK "+o.sitekey;o.callback("ma-thu");return "1"},reset(){},remove(){}}',
      }),
    )
    await page.goto('/dang-nhap')
    await expect(page.getByTestId('captcha')).toHaveText('OK khoa-thu')
    await page.getByLabel('Email').fill('khong-co@demo.local')
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau')
    const request = page.waitForRequest('**/auth/v1/token**')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    const body = (await request).postDataJSON() as { gotrue_meta_security?: { captcha_token?: string } }
    expect(body.gotrue_meta_security?.captcha_token).toBe('ma-thu')
    await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible()
  } finally {
    await sql(`update public.site_settings set value = $1 where key = 'auth_options'`, [
      JSON.stringify(saved!.value),
    ])
  }
})
