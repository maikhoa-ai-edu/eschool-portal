import { expect, test, type Page } from '@playwright/test'
import { sql } from './db.ts'
import { login, makePng, otherMachine, SAMPLE_PDF, screenshotPath, uniqueSuffix } from './helpers.ts'

/**
 * Giai đoạn 4: các module nội dung. Dữ liệu tạo ra mang tiền tố "E2E" và được dọn sau khi chạy
 * (văn bản, album xóa qua giao diện để xóa cả file trong Storage).
 */
test.afterAll(async () => {
  await sql(`
    delete from public.news where title like 'E2E %';
    delete from public.news_tags where slug like 'e2e-%';
    delete from public.announcements where title like 'E2E %';
    delete from public.menu_items where title like 'E2E %';
    delete from public.pages where title like 'E2E %';
  `)
})

/** Ô soạn thảo TipTap: bấm vào rồi gõ như người dùng. */
async function typeContent(page: Page, label: string, text: string) {
  const editor = page.getByRole('textbox', { name: label })
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(text)
}

test.describe('Tin tức', () => {
  test('biên tập viên viết → quản trị trả lại → sửa → duyệt & đăng → máy khác thấy ngay', async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name === 'mobile', 'Luồng quản trị kiểm tra trên desktop')
    test.setTimeout(120_000)
    const title = `E2E Tin hội thao ${uniqueSuffix()}`

    // Biên tập viên soạn bài và gửi duyệt
    await login(page, 'editor@demo.local', '/admin/tin-tuc/moi')
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title)
    await expect(page.getByLabel('Đường dẫn', { exact: true })).toHaveValue(/^e2e-tin-hoi-thao-/)
    await page.getByLabel('Tóm tắt', { exact: true }).fill('Hội thao chào mừng ngày Nhà giáo Việt Nam.')
    await typeContent(page, 'Nội dung bài viết', 'Sáng nay toàn trường tổ chức hội thao.')
    await page.getByLabel('Thẻ', { exact: true }).fill('E2E hội thao, thể thao')
    await expect(page.getByLabel('Tin nổi bật')).toHaveCount(0)
    await page.getByRole('button', { name: 'Gửi duyệt' }).click()
    await expect(page.getByText('Đã gửi bài cho quản trị viên duyệt.')).toBeVisible()
    await expect(page.getByText('Chờ duyệt', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Duyệt & đăng' })).toHaveCount(0)
    const editorUrl = page.url()

    // Khách chưa thấy bài chờ duyệt
    const guest = await otherMachine(browser, info)
    await guest.goto('/tin-tuc')
    await expect(guest.getByRole('heading', { name: 'Tin tức', level: 1 })).toBeVisible()
    await expect(guest.getByText(title)).toHaveCount(0)

    // Quản trị viên (máy khác) thấy bài trong danh sách chờ duyệt và trả lại kèm góp ý
    const admin = await otherMachine(browser, info)
    await login(admin, 'admin@demo.local', '/admin/tin-tuc?trang-thai=pending')
    await admin.getByRole('link', { name: title }).click()
    admin.once('dialog', (dialog) => void dialog.accept('Bổ sung ảnh minh họa'))
    await admin.getByRole('button', { name: 'Trả lại tác giả' }).click()
    await expect(admin.getByText('Đã trả bài lại cho tác giả kèm góp ý.')).toBeVisible()

    // Biên tập viên thấy góp ý, sửa và gửi lại
    await page.goto(editorUrl)
    await expect(page.getByText('Góp ý của người duyệt')).toBeVisible()
    await expect(page.getByText('Bổ sung ảnh minh họa')).toBeVisible()
    await typeContent(page, 'Nội dung bài viết', ' Đã bổ sung.')
    await page.getByRole('button', { name: 'Gửi duyệt' }).click()
    await expect(page.getByText('Đã gửi bài cho quản trị viên duyệt.')).toBeVisible()

    // Quản trị viên duyệt và đánh dấu nổi bật
    await admin.reload()
    await admin.getByLabel('Tin nổi bật').check()
    await admin.screenshot({ path: screenshotPath('admin-news-review', info) })
    await admin.getByRole('button', { name: 'Duyệt & đăng' }).click()
    await expect(admin.getByText('Bài viết đã được đăng.')).toBeVisible()
    await expect(admin.getByText('Đã đăng', { exact: true })).toBeVisible()

    // Máy khách thấy ngay, xem chi tiết, lọc theo thẻ, tìm không dấu
    await guest.reload()
    await guest.getByRole('link', { name: title }).click()
    await expect(guest.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(guest.getByText('Sáng nay toàn trường tổ chức hội thao. Đã bổ sung.')).toBeVisible()
    await expect(guest.getByText('Giáo viên biên tập')).toBeVisible()
    await guest.screenshot({ path: screenshotPath('news-detail', info), fullPage: true })
    await guest.getByRole('link', { name: 'E2E hội thao' }).click()
    await expect(guest.getByRole('heading', { name: 'Thẻ: E2E hội thao' })).toBeVisible()
    await expect(guest.getByRole('link', { name: title })).toBeVisible()
    await guest.goto('/tin-tuc?q=' + encodeURIComponent('hoi thao chao mung'))
    await expect(guest.getByRole('link', { name: title })).toBeVisible()

    // Bài đã đăng: biên tập viên chỉ xem, không sửa được
    await page.reload()
    await expect(page.getByText('Bài viết đã được xuất bản')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gửi duyệt' })).toHaveCount(0)
  })

  test('nội dung chứa mã độc được DOMPurify làm sạch khi hiển thị', async ({ page }) => {
    const slug = `e2e-xss-${uniqueSuffix()}`
    await sql(
      `insert into public.news (title, slug, content, category_id, author_id, status)
       values ($1, $2, $3, '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 'published')`,
      [
        `E2E Bài thử XSS ${slug}`,
        slug,
        '<p>An toàn</p><img src="x" onerror="window.__xss = 1"><script>window.__xss = 2</script>',
      ],
    )
    await page.goto(`/tin-tuc/${slug}`)
    await expect(page.getByText('An toàn')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    await expect(page.locator('.rich-content img[onerror]')).toHaveCount(0)
  })

  test('danh sách tin công khai (ảnh chụp)', async ({ page }, info) => {
    await page.goto('/tin-tuc')
    await expect(
      page.getByRole('link', { name: 'Câu lạc bộ STEM ra mắt mô hình tưới nước thông minh' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Chuyên mục' })).toBeVisible()
    await page.screenshot({ path: screenshotPath('news-list', info), fullPage: true })
    await page.getByRole('link', { name: 'Câu lạc bộ STEM ra mắt mô hình tưới nước thông minh' }).click()
    await expect(page.getByRole('heading', { name: 'Cách hoạt động' })).toBeVisible()
    await page.screenshot({ path: screenshotPath('news-detail-seed', info), fullPage: true })
  })
})

test.describe('Thông báo, trang tĩnh, menu', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng quản trị kiểm tra trên desktop')

  test('đăng thông báo khẩn, khách thấy ngay', async ({ page, browser }, info) => {
    const title = `E2E Nghỉ học do bão ${uniqueSuffix()}`
    await login(page, 'admin@demo.local', '/admin/thong-bao/moi')
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title)
    await typeContent(page, 'Nội dung thông báo', 'Học sinh nghỉ học ngày mai.')
    await page.getByLabel('Mức độ').selectOption('urgent')
    await page.getByLabel('Ghim lên đầu').check()
    await page.getByRole('button', { name: 'Đăng thông báo' }).click()
    await expect(page.getByText('Đã đăng thông báo.')).toBeVisible()

    const guest = await otherMachine(browser, info)
    await guest.goto('/thong-bao')
    const item = guest.getByRole('listitem').filter({ hasText: title })
    await expect(item.getByText('Khẩn')).toBeVisible()
    await guest.screenshot({ path: screenshotPath('announcements', info), fullPage: true })
    await item.getByRole('link', { name: title }).click()
    await expect(guest.getByText('Học sinh nghỉ học ngày mai.')).toBeVisible()
  })

  test('tạo trang tĩnh, gắn vào menu chính, khách bấm menu mở được trang', async ({
    page,
    browser,
  }, info) => {
    const suffix = uniqueSuffix()
    const title = `E2E Cơ cấu tổ chức ${suffix}`
    await login(page, 'admin@demo.local', '/admin/trang/moi')
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title)
    await typeContent(page, 'Nội dung trang', 'Ban giám hiệu gồm Hiệu trưởng và hai Phó Hiệu trưởng.')
    await page.getByRole('button', { name: 'Lưu trang' }).click()
    await expect(page.getByText('Đã lưu trang.')).toBeVisible()
    const slug = await page.getByLabel('Đường dẫn', { exact: true }).inputValue()

    await page.goto('/admin/menu')
    await page.getByRole('button', { name: 'Thêm mục menu' }).click()
    await page.getByLabel('Chọn nhanh liên kết').selectOption(`/trang/${slug}`)
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue(title)
    await page.getByLabel('Tên hiển thị').fill(`E2E Tổ chức ${suffix}`)
    await page.getByLabel('Thuộc mục').selectOption({ label: 'Giới thiệu' })
    await page.getByRole('button', { name: 'Thêm mục', exact: true }).click()
    await expect(page.getByText(`/trang/${slug}`, { exact: true })).toBeVisible()
    await page.screenshot({ path: screenshotPath('admin-menu', info) })

    const guest = await otherMachine(browser, info)
    await guest.goto('/')
    const nav = guest.getByRole('navigation', { name: 'Menu chính' })
    await nav.getByRole('button', { name: 'Giới thiệu' }).hover()
    // Mục cha có mục con vẫn vào được trang của chính nó
    await expect(nav.getByRole('link', { name: 'Giới thiệu' })).toBeVisible()
    await nav.getByRole('link', { name: `E2E Tổ chức ${suffix}` }).click()
    await expect(guest.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(guest.getByText('Ban giám hiệu gồm Hiệu trưởng')).toBeVisible()
  })

  test('trang Liên hệ có sẵn hiển thị thông tin trường', async ({ page }) => {
    await page.goto('/trang/lien-he')
    await expect(page.getByRole('heading', { name: 'Liên hệ', level: 1 })).toBeVisible()
  })
})

test.describe('Văn bản & thư viện ảnh', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng quản trị kiểm tra trên desktop')

  test('tải văn bản PDF lên, khách tìm không dấu và tải về, rồi xóa', async ({ page, browser }, info) => {
    const title = `E2E Kế hoạch tuyển sinh lớp 10 ${uniqueSuffix()}`
    await login(page, 'admin@demo.local', '/admin/van-ban/moi')
    await page.getByLabel('Tên văn bản (trích yếu)').fill(title)
    await page.getByLabel('Số hiệu').fill('99/KH-E2E')
    await page.getByLabel('Người ký').fill('Nguyễn Văn A')
    await page.getByLabel('Ngày ban hành').fill('2026-10-15')
    await page.getByLabel('File văn bản').setInputFiles({
      name: 'ke-hoach-tuyen-sinh.pdf',
      mimeType: 'application/pdf',
      buffer: SAMPLE_PDF,
    })
    await page.getByRole('button', { name: 'Lưu văn bản' }).click()
    await expect(page.getByText('Đã lưu văn bản.')).toBeVisible()

    const guest = await otherMachine(browser, info)
    await guest.goto('/van-ban?q=' + encodeURIComponent('ke hoach tuyen sinh'))
    const row = guest.getByRole('listitem').filter({ hasText: title })
    await expect(row.getByText('Số: 99/KH-E2E')).toBeVisible()
    await guest.screenshot({ path: screenshotPath('documents', info), fullPage: true })
    const download = row.getByRole('link', { name: 'Tải về' })
    await expect(download).toHaveAttribute(
      'href',
      /\/storage\/v1\/object\/public\/documents\/.+\.pdf\?download=/,
    )
    const response = await guest.request.get((await download.getAttribute('href'))!)
    expect(response.ok()).toBe(true)

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Xóa văn bản' }).click()
    await expect(page).toHaveURL(/\/admin\/van-ban$/)
    const gone = await guest.request.get((await download.getAttribute('href'))!)
    expect(gone.ok()).toBe(false)
  })

  test('tạo album, tải nhiều ảnh, đăng; khách xem ảnh phóng to; rồi xóa album', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000)
    const title = `E2E Hội trại 26-3 ${uniqueSuffix()}`
    await login(page, 'admin@demo.local', '/admin/thu-vien-anh/moi')
    await page.getByLabel('Tên album').fill(title)
    await page.getByLabel('Trạng thái').selectOption('published')
    await page.getByRole('button', { name: 'Tạo album' }).click()
    await expect(page.getByText('Đã tạo album. Tiếp tục tải ảnh lên bên dưới.')).toBeVisible()

    await page.getByLabel('Chọn ảnh tải lên album').setInputFiles([
      { name: 'trai-1.png', mimeType: 'image/png', buffer: makePng(320, 240, [0, 43, 102]) },
      { name: 'trai-2.png', mimeType: 'image/png', buffer: makePng(320, 240, [217, 119, 6]) },
      { name: 'trai-3.png', mimeType: 'image/png', buffer: makePng(240, 320, [21, 128, 61]) },
    ])
    await expect(page.getByText('Ảnh trong album (3)')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Ảnh bìa')).toHaveCount(1)
    page.once('dialog', (dialog) => void dialog.accept('Lễ khai mạc'))
    await page.getByRole('button', { name: 'Thêm chú thích...' }).first().click()
    await expect(page.getByRole('button', { name: 'Lễ khai mạc' })).toBeVisible()
    await page.screenshot({ path: screenshotPath('admin-album', info) })

    const guest = await otherMachine(browser, info)
    await guest.goto('/thu-vien-anh')
    await guest.getByRole('link', { name: new RegExp(title) }).click()
    await expect(guest.getByText('3 ảnh')).toBeVisible()
    await guest.getByRole('button', { name: 'Xem ảnh 1: Lễ khai mạc' }).click()
    const lightbox = guest.getByRole('dialog', { name: 'Ảnh 1/3' })
    await expect(lightbox).toBeVisible()
    await guest.keyboard.press('ArrowRight')
    await expect(guest.getByRole('dialog', { name: 'Ảnh 2/3' })).toBeVisible()
    await guest.screenshot({ path: screenshotPath('album-lightbox', info) })
    await guest.keyboard.press('Escape')
    await expect(guest.getByRole('dialog')).toHaveCount(0)

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Xóa album' }).click()
    await expect(page).toHaveURL(/\/admin\/thu-vien-anh$/)
    const leftovers = await sql<{ n: number }>(
      "select count(*)::int as n from public.albums where title like 'E2E %'",
    )
    expect(leftovers[0]!.n).toBe(0)
  })
})

test.describe('Phân quyền module', () => {
  test.skip(({ isMobile }) => isMobile, 'Kiểm tra trên desktop')

  test('biên tập viên không vào được quản lý thông báo, văn bản, album, menu', async ({ page }) => {
    await login(page, 'editor@demo.local')
    for (const path of ['/admin/thong-bao', '/admin/van-ban/moi', '/admin/thu-vien-anh', '/admin/menu']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    }
  })

  test('module tắt thì trang công khai báo tạm ngừng', async ({ page }) => {
    await sql("update public.module_settings set is_enabled = false where module_key = 'documents'")
    try {
      await page.goto('/van-ban')
      await expect(page.getByRole('heading', { name: 'Chức năng tạm ngừng' })).toBeVisible()
    } finally {
      await sql("update public.module_settings set is_enabled = true where module_key = 'documents'")
    }
  })
})
