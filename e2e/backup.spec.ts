import { expect, test } from '@playwright/test'
import { localSupabase, sql } from './db.ts'
import { latestEmailLink, login, PASSWORD, screenshotPath } from './helpers.ts'

/**
 * Giai đoạn 7. Nghiệm thu: sao lưu trường A rồi khôi phục sang project mới. Project mới được giả lập bằng cách xóa
 * sạch nội dung, file và tài khoản (trừ người khôi phục) trên CSDL cục bộ; afterAll trả lại mật khẩu tài khoản demo.
 */
test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await sql(`
    update auth.users set encrypted_password = extensions.crypt('${PASSWORD}', extensions.gen_salt('bf'))
    where email like '%@demo.local';
    delete from public.audit_logs where table_name = 'backup';
    update public.app_meta set value = (select max(value) from public.app_meta where key = 'schema_version_e2e')
    where key = 'schema_version' and exists (select 1 from public.app_meta where key = 'schema_version_e2e');
    delete from public.app_meta where key = 'schema_version_e2e';
  `)
})

async function serviceToken(): Promise<{ url: string; anonKey: string; token: string }> {
  const { url, anonKey } = localSupabase()
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@demo.local', password: PASSWORD }),
  })
  return { url, anonKey, token: ((await res.json()) as { access_token: string }).access_token }
}

test('sao lưu rồi khôi phục sang project trống: nội dung, ảnh, tài khoản đều về đủ', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  await login(page, 'superadmin@demo.local', '/admin/sao-luu')
  await expect(page.getByRole('heading', { name: 'Sao lưu & khôi phục' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải bản sao lưu' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^sao-luu-\d{4}-\d{2}-\d{2}\.zip$/)
  const zipPath = test.info().outputPath('backup.zip')
  await download.saveAs(zipPath)
  await expect(page.getByText(/Kèm \d+ file/)).toBeVisible()
  await page.screenshot({ path: screenshotPath('backup', info) })

  // "Project mới": không còn nội dung, file, tài khoản khác
  const { url, anonKey, token } = await serviceToken()
  const logoUrl = `${url}/storage/v1/object/media/seed/logo.jpg`
  const removed = await fetch(logoUrl, {
    method: 'DELETE',
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  })
  expect(removed.ok).toBe(true)
  await sql(`
    delete from public.news where true;
    delete from public.pages where true;
    delete from auth.users where email in ('editor@demo.local', 'admin@demo.local', 'giaovien.van@demo.local');
    update public.site_settings set value = value || '{"school_name":"Tên trường"}' where key = 'school_identity';
  `)
  await page.goto('/admin/sao-luu')
  await page.getByLabel('Chọn file sao lưu').setInputFiles(zipPath)
  await expect(page.getByText('Trường THCS & THPT Vĩnh Phong')).toBeVisible()
  await page.screenshot({ path: screenshotPath('restore-preview', info), fullPage: true })

  const restoreButton = page.getByRole('button', { name: 'Khôi phục', exact: true })
  await expect(restoreButton).toBeDisabled()
  await page.getByLabel('Gõ KHÔI PHỤC để xác nhận').fill('KHÔI PHỤC')
  await restoreButton.click()
  await expect(page.getByText('Đã khôi phục xong')).toBeVisible({ timeout: 60_000 })

  // Khách thấy lại nội dung và ảnh thật
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Trường THCS & THPT Vĩnh Phong', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /Câu lạc bộ STEM ra mắt mô hình/ }).first()).toBeVisible()
  const logo = await fetch(`${url}/storage/v1/object/public/media/seed/logo.jpg`)
  expect(logo.ok).toBe(true)
  await page.goto('/van-ban')
  await expect(page.getByRole('link', { name: /Kế hoạch thực hiện nhiệm vụ năm học/ }).first()).toBeVisible()

  const rows = await sql<{ role: string; encrypted_password: string }>(
    `select p.role, u.encrypted_password from public.profiles p join auth.users u on u.id = p.id
     where p.email = 'editor@demo.local'`,
  )
  expect(rows).toEqual([{ role: 'EDITOR', encrypted_password: '' }])

  // Tài khoản khôi phục lấy mật khẩu bằng "Quên mật khẩu"
  await page
    .getByRole('button', { name: 'Đăng xuất' })
    .click({ timeout: 1000 })
    .catch(() => undefined)
  const context = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL })
  const editor = await context.newPage()
  await editor.goto('/quen-mat-khau')
  await editor.getByLabel('Email').fill('editor@demo.local')
  await editor.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }).click()
  await expect(editor.getByText('Đã xử lý yêu cầu')).toBeVisible()
  await expect.poll(() => latestEmailLink('editor@demo.local').then((l) => l.length > 0)).toBe(true)
  await editor.goto(await latestEmailLink('editor@demo.local'))
  await editor.getByLabel('Mật khẩu mới').fill('matkhaumoi123')
  await editor.getByLabel('Nhập lại mật khẩu').fill('matkhaumoi123')
  await editor.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
  await expect(editor.getByRole('heading', { name: 'Xin chào, Giáo viên biên tập' })).toBeVisible()
  await context.close()
})

test('EDITOR và ADMIN không vào được trang sao lưu, cập nhật', async ({ page }) => {
  await sql(`update auth.users set encrypted_password = extensions.crypt('${PASSWORD}', extensions.gen_salt('bf'))
    where email like '%@demo.local'`)
  await login(page, 'admin@demo.local', '/admin/sao-luu')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  await page.goto('/admin/cap-nhat')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
})

test('trang cập nhật: báo bản mới và đưa đúng SQL nâng cấp khi CSDL cũ hơn', async ({ page }, info) => {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: {
        tag_name: 'v99.0.0',
        html_url: 'https://github.com/maikhoa-ai-edu/eschool-portal/releases/tag/v99.0.0',
      },
    }),
  )
  await login(page, 'superadmin@demo.local', '/admin/cap-nhat')
  await expect(page.getByText('Có bản mới: 99.0.0')).toBeVisible()
  await expect(page.getByText(/CSDL đúng phiên bản/)).toBeVisible()

  const [{ value }] = await sql<{ value: string }>(
    `select value from public.app_meta where key = 'schema_version'`,
  )
  await sql(`insert into public.app_meta (key, value) values ('schema_version_e2e', $1)`, [value])
  await sql(`update public.app_meta set value = '0.6.0' where key = 'schema_version'`)
  await page.reload()
  const box = page.getByLabel('SQL nâng cấp')
  await expect(box).toHaveValue(/CSDL phải đang ở phiên bản 0\.6\.0/)
  await expect(box).not.toHaveValue(/invitation_token/)
  await page.screenshot({ path: screenshotPath('update', info), fullPage: true })

  await sql(`update public.app_meta set value = $1 where key = 'schema_version'`, [value])
  await sql(`delete from public.app_meta where key = 'schema_version_e2e'`)
  await page.getByRole('button', { name: 'Tôi đã chạy xong, kiểm tra lại' }).click()
  await expect(page.getByText(/CSDL đúng phiên bản/)).toBeVisible()
})
