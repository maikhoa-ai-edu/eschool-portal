import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, screenshotPath, uniqueSuffix } from './helpers.ts'

/** Giai đoạn 8.6 đợt B: trang bài viết, cột phải của Thông báo và Văn bản. */
const C1 = '00000000-0000-0000-0000-0000000000c1'
const FOLDER_PLANS = '00000000-0000-0000-0000-0000000000f5'
const GROUP_EXAM = '00000000-0000-0000-0000-0000000000f1'

test.afterAll(async () => {
  await sql(`delete from public.news where title like 'E2E %'`)
})

async function articleWith(content: string): Promise<string> {
  const slug = `e2e-bai-${uniqueSuffix()}`
  await sql(
    `insert into public.news (title, slug, excerpt, content, thumbnail_url, category_id, author_id, status, published_at,
       author_name, source_name, source_url)
     select 'E2E Bài có mục lục', $1, 'Sapo của bài', $2, 'seed/slide-hoc-tap-rsw.jpg', $3, id, 'published', now(),
       'E2E Tác giả', 'E2E Báo', 'https://example.com/bai'
     from public.profiles where email = 'admin@demo.local'`,
    [slug, content, C1],
  )
  return slug
}

test('bài viết: ảnh sau sapo, mục lục, tác giả và nguồn, tin liên quan', async ({ page }, info) => {
  const slug = await articleWith('<h2>Một</h2><p>a</p><h2>Hai</h2><p>b</p><h3>Ba</h3><p>c</p>')
  await page.goto(`/tin-tuc/${slug}`)
  const article = page.getByRole('article')
  const sapo = article.getByText('Sapo của bài')
  const image = article.locator('img').first()
  const [sapoBox, imageBox] = [await sapo.boundingBox(), await image.boundingBox()]
  expect(imageBox!.y).toBeGreaterThan(sapoBox!.y)

  const toc = page.getByRole('navigation', { name: 'Mục lục bài viết' })
  const toggle = toc.getByRole('button')
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await toc.getByRole('link', { name: 'Hai' }).click()
  await expect(page).toHaveURL(/#muc-hai$/)
  await toggle.click()
  await expect(toc.getByRole('link')).toHaveCount(0)

  await expect(article.getByText('E2E Tác giả')).toBeVisible()
  await expect(article.getByRole('link', { name: 'E2E Báo' })).toHaveAttribute(
    'href',
    'https://example.com/bai',
  )
  await expect(page.getByRole('heading', { name: 'Tin liên quan' })).toBeVisible()
  await page.screenshot({ path: screenshotPath('article', info), fullPage: true })
})

test('bài ít tiêu đề không hiện mục lục', async ({ page }) => {
  const slug = await articleWith('<h2>Một</h2><p>a</p>')
  await page.goto(`/tin-tuc/${slug}`)
  await expect(page.getByRole('heading', { name: 'Một' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Mục lục bài viết' })).toHaveCount(0)
})

test('thông báo: lọc theo phân loại ở cột phải', async ({ page }, info) => {
  await page.goto('/thong-bao')
  await page.getByRole('complementary').getByRole('link', { name: 'Học vụ' }).click()
  await expect(page).toHaveURL(new RegExp(`phan-loai=${GROUP_EXAM}`))
  await expect(page.getByRole('heading', { level: 2, name: /kiểm tra/i }).first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /Lịch nghỉ/ })).toHaveCount(0)
  await page.screenshot({ path: screenshotPath('announcements-sidebar', info), fullPage: true })
})

test('văn bản: thư mục lọc cả thư mục con, có xem nhiều và tải nhiều, mở văn bản thì tăng lượt xem', async ({
  page,
}, info) => {
  await page.goto('/van-ban')
  const aside = page.getByRole('complementary')
  await expect(aside.getByRole('heading', { name: 'Xem nhiều' })).toBeVisible()
  await aside.getByRole('link', { name: 'Văn bản nhà trường' }).click()
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: /^Kế hoạch/ })
      .first(),
  ).toBeVisible()
  await aside.getByRole('link', { name: 'Kế hoạch', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`thu-muc=${FOLDER_PLANS}`))
  await page.screenshot({ path: screenshotPath('documents-sidebar', info), fullPage: true })

  const [doc] = await sql<{ id: string; view_count: number }>(
    `select id, view_count from public.documents where status = 'published' limit 1`,
  )
  await page.goto(`/van-ban/${doc!.id}`)
  await expect
    .poll(async () => {
      const [row] = await sql<{ view_count: number }>(
        `select view_count from public.documents where id = $1`,
        [doc!.id],
      )
      return row!.view_count
    })
    .toBeGreaterThan(doc!.view_count)
})

test('quản trị: thêm thư mục con, gán nguồn cho bài', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Luồng quản trị chỉ chạy trên desktop')
  const name = `E2E Thư mục ${uniqueSuffix()}`
  await login(page, 'admin@demo.local', '/admin/van-ban/thu-muc')
  await page.getByLabel('Tên').fill(name)
  await page.getByLabel('Thuộc thư mục').selectOption({ label: 'Biểu mẫu, tài liệu' })
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(page.getByText(`— ${name}`)).toBeVisible()

  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: `Xóa "${name}"` }).click()
  await expect(page.getByText(`— ${name}`)).toHaveCount(0)

  await page.goto('/admin/tin-tuc/moi')
  await expect(page.getByLabel('Nguồn bài viết')).toBeVisible()
  await expect(page.getByLabel('Liên kết nguồn')).toBeVisible()
})
