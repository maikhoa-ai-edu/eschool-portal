import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { latestEmailLink, login, otherMachine, PASSWORD, screenshotPath, uniqueSuffix } from './helpers.ts'

/**
 * Giai đoạn 6: quản trị hệ thống. Nghiệm thu: mời giáo viên làm EDITOR, giáo viên đăng ký bằng email được mời
 * rồi soạn được bài. Email tiền tố "e2e-" và bài tiền tố "E2E " được dọn sau mỗi test.
 */
test.afterEach(async () => {
  await sql(`
    delete from public.news where title like 'E2E %';
    delete from auth.users where email like 'e2e-%';
    delete from public.invitations where email like 'e2e-%';
    delete from public.audit_logs where summary like 'e2e-%' or summary like 'E2E %';
  `)
})

test.describe('Tài khoản & lời mời', () => {
  test('mời giáo viên làm EDITOR, giáo viên đăng ký rồi soạn được bài', async ({ page, browser }, info) => {
    const email = `e2e-giaovien-${uniqueSuffix()}@demo.local`
    await login(page, 'superadmin@demo.local', '/admin/tai-khoan')
    await expect(page.getByRole('heading', { name: 'Tài khoản', level: 1 })).toBeVisible()
    await page.screenshot({ path: screenshotPath('accounts', info) })

    await page.getByLabel('Email người được mời').fill(email)
    await page.getByLabel('Vai trò', { exact: true }).selectOption('EDITOR')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    const link = await page.getByLabel('Liên kết mời').inputValue()
    expect(link).toContain('/dang-ky?email=')
    await expect(page.getByRole('cell', { name: email })).toBeVisible()

    // Giáo viên mở liên kết trên máy khác
    const teacher = await otherMachine(browser, info)
    await teacher.goto(link)
    await expect(teacher.getByLabel('Email được mời')).toHaveValue(email)
    await teacher.getByLabel('Họ và tên').fill('E2E Giáo viên mới')
    await teacher.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
    await teacher.getByLabel('Nhập lại mật khẩu').fill(PASSWORD)
    await teacher.screenshot({ path: screenshotPath('register', info) })
    await teacher.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(teacher.getByRole('heading', { name: 'Xin chào, E2E Giáo viên mới' })).toBeVisible()

    await teacher.goto('/admin/tin-tuc/moi')
    await teacher.getByRole('textbox', { name: 'Tiêu đề' }).fill('E2E Bài của giáo viên mới')
    await teacher.getByRole('textbox', { name: 'Nội dung' }).click()
    await teacher.keyboard.type('Nội dung bài viết của giáo viên mới.')
    await teacher.getByRole('button', { name: 'Gửi duyệt' }).click()
    await expect(teacher.getByText('Chờ duyệt').first()).toBeVisible()
    const rows = await sql<{ status: string; role: string }>(
      `select n.status, p.role from public.news n join public.profiles p on p.id = n.author_id
       where n.title = 'E2E Bài của giáo viên mới'`,
    )
    expect(rows).toEqual([{ status: 'pending', role: 'EDITOR' }])

    // Lời mời đã nhận, tài khoản hiện trong danh sách; khóa thì giáo viên mất quyền ngay
    await page.reload()
    const row = page.getByRole('row', { name: new RegExp(email) }).first()
    await expect(row.getByRole('combobox')).toHaveValue('EDITOR')
    page.once('dialog', (d) => void d.accept())
    await row.getByRole('button', { name: 'Khóa' }).click()
    await expect(row.getByText('Đã khóa')).toBeVisible()
    await teacher.goto('/admin')
    await expect(teacher.getByRole('heading', { name: 'Tài khoản đã bị khóa' })).toBeVisible()
    await teacher.context().close()
  })

  test('email chưa được mời không đăng ký được', async ({ page }) => {
    await page.goto(
      `/dang-ky?email=e2e-nguoila-${uniqueSuffix()}%40demo.local&ma=00000000-0000-0000-0000-000000000000`,
    )
    await page.getByLabel('Họ và tên').fill('Người lạ')
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(page.getByRole('alert')).toContainText('Lời mời không hợp lệ')

    // Không có mã thì không hiện biểu mẫu
    await page.goto('/dang-ky?email=giaovien.toan%40demo.local')
    await expect(page.getByText('Cần có liên kết mời')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tạo tài khoản' })).toHaveCount(0)
  })

  test('đổi vai trò, gia hạn và thu hồi lời mời, chặn mời trùng', async ({ page }) => {
    const email = `e2e-hethan-${uniqueSuffix()}@demo.local`
    await sql(
      `insert into public.invitations (email, role, invited_by, expires_at)
       values ($1, 'EDITOR', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day')`,
      [email],
    )
    await login(page, 'superadmin@demo.local', '/admin/tai-khoan')

    // Lời mời hết hạn vẫn giữ chỗ email: báo rõ thay vì lỗi chung
    await page.getByLabel('Email người được mời').fill(email)
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.getByRole('alert')).toContainText('đang có lời mời chưa dùng')

    await page.getByLabel('Email người được mời').fill('editor@demo.local')
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.getByRole('alert')).toContainText('đã có tài khoản')

    const row = page.getByRole('row', { name: new RegExp(email) })
    await expect(row.getByText('Hết hạn')).toBeVisible()
    await row.getByRole('button', { name: 'Gia hạn' }).click()
    await expect(row.getByText('Chờ đăng ký')).toBeVisible()

    page.once('dialog', (d) => void d.accept())
    await row.getByRole('button', { name: 'Thu hồi' }).click()
    await expect(page.getByRole('cell', { name: email })).toHaveCount(0)

    // Đổi vai trò rồi trả lại
    const select = page.getByRole('combobox', { name: 'Vai trò của Lê Thị Hoa' })
    await select.selectOption('ADMIN')
    await expect
      .poll(
        async () =>
          (await sql(`select role from public.profiles where email = 'giaovien.van@demo.local'`))[0]?.role,
      )
      .toBe('ADMIN')
    await select.selectOption('EDITOR')
    await expect
      .poll(
        async () =>
          (await sql(`select role from public.profiles where email = 'giaovien.van@demo.local'`))[0]?.role,
      )
      .toBe('EDITOR')
  })
})

test.describe('Quên mật khẩu', () => {
  const email = `e2e-quenmatkhau-${uniqueSuffix()}@demo.local`

  test('nhận thư, đặt mật khẩu mới rồi đăng nhập được', async ({ page, browser }, info) => {
    await sql(
      `insert into public.invitations (email, role, token, invited_by) values
       ($1, 'EDITOR', '00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-0000000000a1')`,
      [email],
    )
    await page.goto(`/dang-ky?email=${encodeURIComponent(email)}&ma=00000000-0000-0000-0000-00000000bbbb`)
    await page.getByLabel('Họ và tên').fill('E2E Quên mật khẩu')
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD)
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(page.getByRole('heading', { name: 'Xin chào, E2E Quên mật khẩu' })).toBeVisible()

    const guest = await otherMachine(browser, info)
    await guest.goto('/dang-nhap')
    await guest.getByRole('link', { name: 'Quên mật khẩu?' }).click()
    await expect(guest.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible()
    await guest.getByLabel('Email').fill(email)
    await guest.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }).click()
    await expect(guest.getByText('Đã xử lý yêu cầu')).toBeVisible()

    await guest.goto(await latestEmailLink(email))
    await expect(guest).toHaveURL(/\/dat-lai-mat-khau/)
    await guest.getByLabel('Mật khẩu mới').fill('matkhaumoi123')
    await guest.getByLabel('Nhập lại mật khẩu').fill('matkhaumoi123')
    await guest.screenshot({ path: screenshotPath('reset-password', info) })
    await guest.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(guest.getByRole('heading', { name: 'Xin chào, E2E Quên mật khẩu' })).toBeVisible()
    await guest.context().close()

    const fresh = await otherMachine(browser, info)
    await fresh.goto('/dang-nhap')
    await fresh.getByLabel('Email').fill(email)
    await fresh.getByLabel('Mật khẩu').fill('matkhaumoi123')
    await fresh.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(fresh.getByRole('heading', { name: 'Xin chào, E2E Quên mật khẩu' })).toBeVisible()
    await fresh.context().close()
  })

  test('liên kết không hợp lệ thì không cho đặt mật khẩu', async ({ page }) => {
    await page.goto('/dat-lai-mat-khau')
    await expect(page.getByText('Liên kết không hợp lệ hoặc đã hết hạn')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toHaveCount(0)
  })
})

test.describe('Nhật ký', () => {
  test('lọc theo người, mục dữ liệu và thời gian', async ({ page }, info) => {
    await login(page, 'superadmin@demo.local', '/admin/nhat-ky')
    await expect(page.getByRole('heading', { name: 'Nhật ký', level: 1 })).toBeVisible()
    // Các test khác cũng ghi nhật ký, nên chỉ tìm dòng của dữ liệu mẫu sau khi đã lọc
    await expect(page.getByText(/\d+ dòng nhật ký/)).toBeVisible()
    await page.screenshot({ path: screenshotPath('audit', info) })

    await page.getByLabel('Người thực hiện').selectOption({ label: 'Phó Hiệu trưởng' })
    await expect(page).toHaveURL(/nguoi=/)
    await expect(page.getByRole('cell', { name: /Lời mời:/ })).toHaveCount(0)

    await page.getByLabel('Mục dữ liệu').selectOption({ label: 'Thông báo' })
    await expect(page).toHaveURL(/bang=announcements/)
    await expect(page.getByRole('cell', { name: /Thông báo: Tiêm chủng/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: /Tin tức:/ })).toHaveCount(0)

    await page.getByLabel('Đến ngày').fill('2020-01-01')
    await expect(page.getByText('Không có dòng nhật ký nào khớp bộ lọc')).toBeVisible()
  })

  test('thao tác thật được ghi kèm người thực hiện', async ({ page }) => {
    const email = `e2e-nhatky-${uniqueSuffix()}@demo.local`
    await login(page, 'superadmin@demo.local', '/admin/tai-khoan')
    await page.getByLabel('Email người được mời').fill(email)
    await page.getByRole('button', { name: 'Tạo lời mời' }).click()
    await expect(page.getByLabel('Liên kết mời')).toBeVisible()

    await page.goto('/admin/nhat-ky?bang=invitations')
    const row = page.getByRole('row', { name: new RegExp(email) })
    await expect(row.getByText('Quản trị hệ thống')).toBeVisible()
    await expect(row.getByText('Thêm')).toBeVisible()
  })
})

test.describe('Bảng điều khiển & kiểm tra hệ thống', () => {
  test('SUPER_ADMIN thấy biểu đồ, việc cần làm, hoạt động gần đây', async ({ page }, info) => {
    await login(page, 'superadmin@demo.local')
    await expect(page.getByTestId('visit-bar')).toHaveCount(30)
    await expect(page.getByRole('link', { name: /bài đang đợi bạn duyệt/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /lời mời đã hết hạn/ })).toBeVisible()
    await expect(page.getByText('Hoạt động gần đây')).toBeVisible()
    await page.screenshot({ path: screenshotPath('dashboard', info) })
    await page.getByTestId('visit-bar').nth(20).click()
    await expect(page.getByRole('status').filter({ hasText: 'lượt' })).toBeVisible()
    await page.screenshot({ path: screenshotPath('dashboard-tooltip', info) })
  })

  test('EDITOR không thấy hoạt động gần đây và nhật ký', async ({ page }) => {
    await login(page, 'editor@demo.local')
    await expect(page.getByTestId('visit-bar')).toHaveCount(30)
    await expect(page.getByText('Hoạt động gần đây')).toHaveCount(0)
    await page.goto('/admin/nhat-ky')
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  })

  test('kiểm tra hệ thống dùng số liệu thật, không lỗi trên CSDL mẫu', async ({ page }, info) => {
    await login(page, 'superadmin@demo.local', '/admin/he-thong')
    await expect(page.getByText('Mọi bảng đều đã bật.')).toBeVisible()
    await expect(page.getByText('Dịch vụ lưu trữ')).toBeVisible()
    await expect(page.getByText(/\d+ file,/)).toBeVisible()
    await expect(page.getByText('Xác nhận email')).toBeVisible()
    await expect(page.getByLabel('Lỗi', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: screenshotPath('status', info), fullPage: false })
  })
})
