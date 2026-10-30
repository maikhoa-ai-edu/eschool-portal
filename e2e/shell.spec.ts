import { expect, test } from '@playwright/test'
import { login } from './helpers.ts'

test.describe('Trang công khai', () => {
  test('hiển thị nhận diện trường, menu từ CSDL và bộ đếm truy cập', async ({ page }, info) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Trường THCS & THPT Vĩnh Phong', level: 1 })).toBeVisible()
    await expect(page.getByText('Sở Giáo dục và Đào tạo An Giang')).toBeVisible()
    await expect(page.getByText('Thiết kế bởi MVK')).toBeVisible()
    await expect(page.getByText(/Lượt truy cập:/)).toBeVisible()
    await expect(page).toHaveTitle('Trường THCS & THPT Vĩnh Phong')

    const nav = page.getByRole('navigation', { name: 'Menu chính' })
    if (info.project.name === 'mobile') {
      await nav.getByRole('button', { name: 'Mở menu' }).click()
    }
    await expect(nav.getByRole('link', { name: 'Tin tức' })).toBeVisible()
    await page.screenshot({ path: `test-results/screens/home-${info.project.name}.png`, fullPage: true })
  })

  test('trang không tồn tại hiện 404 trong layout công khai', async ({ page }) => {
    await page.goto('/khong-co-trang-nay')
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  })
})

test.describe('Đăng nhập & phân quyền', () => {
  test('chưa đăng nhập vào /admin bị chuyển tới trang đăng nhập', async ({ page }) => {
    await page.goto('/admin/tin-tuc')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fadmin%2Ftin-tuc/)
  })

  test('sai mật khẩu báo lỗi tiếng Việt', async ({ page }) => {
    await page.goto('/dang-nhap')
    await page.getByLabel('Email').fill('editor@demo.local')
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.')
  })

  test('EDITOR chỉ thấy chức năng được phép', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'Kiểm tra sidebar trên desktop')
    await login(page, 'editor@demo.local')
    await expect(page.getByRole('heading', { name: 'Xin chào, Giáo viên biên tập' })).toBeVisible()
    const sidebar = page.getByRole('navigation', { name: 'Menu quản trị' })
    await expect(sidebar.getByRole('link', { name: 'Tin tức' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Tài khoản' })).toHaveCount(0)
    await expect(sidebar.getByRole('link', { name: 'Thông báo' })).toHaveCount(0)
    await expect(page.getByText('Tin của bạn đang chờ duyệt')).toBeVisible()

    // Gõ thẳng đường dẫn vẫn bị chặn
    await page.goto('/admin/tai-khoan')
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screens/admin-editor-forbidden.png' })
  })

  test('SUPER_ADMIN thấy đủ menu quản trị và đăng xuất được', async ({ page }, info) => {
    await login(page, 'superadmin@demo.local')
    await expect(page.getByRole('heading', { name: 'Xin chào, Quản trị hệ thống' })).toBeVisible()
    await expect(page.getByText('Tin chờ duyệt', { exact: true })).toBeVisible()

    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
    }
    const sidebar = page.getByRole('navigation', { name: 'Menu quản trị' })
    await expect(sidebar.getByRole('link', { name: 'Tài khoản' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Nhật ký' })).toBeVisible()
    await page.screenshot({
      path: `test-results/screens/admin-superadmin-${info.project.name}.png`,
      fullPage: true,
    })

    if (info.project.name === 'mobile') {
      // Chuyển trang thì menu di động tự đóng
      await sidebar.getByRole('link', { name: 'Trạng thái hệ thống' }).click()
      await expect(page.getByRole('dialog', { name: 'Menu quản trị' })).toHaveCount(0)
    } else {
      await sidebar.getByRole('link', { name: 'Trạng thái hệ thống' }).click()
    }
    await expect(page.getByText('0.4.0').first()).toBeVisible()

    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/dang-nhap/)
  })
})
