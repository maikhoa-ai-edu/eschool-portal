import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, uniqueSuffix } from './helpers.ts'

/** Slide lấy từ bài viết: tick khi soạn bài, thứ tự sau slide tạo tay, không lặp ở khối khác, tự lấy tin mới nhất. */
test.describe.configure({ mode: 'serial' })

const STEM = 'clb-stem-ra-mat-mo-hinh-tuoi-nuoc-thong-minh'
const CATEGORY = '00000000-0000-0000-0000-0000000000c1'
const AUTHOR = '00000000-0000-0000-0000-0000000000a2'
let homepage: unknown

async function setHomepage(patch: object) {
  await sql(`update public.site_settings set value = value || $1::jsonb where key = 'homepage'`, [
    JSON.stringify(patch),
  ])
}

test.beforeEach(async () => {
  const rows = await sql<{ value: unknown }>(`select value from public.site_settings where key = 'homepage'`)
  homepage = rows[0]!.value
})

test.afterEach(async () => {
  await sql(`update public.site_settings set value = $1 where key = 'homepage'`, [JSON.stringify(homepage)])
  await sql(`update public.news set show_on_slider = false where show_on_slider`)
  await sql(`update public.homepage_slides set is_active = true where not is_active`)
  await sql(`delete from public.news where title like 'E2E slide %'`)
})

test('bài được tick hiện sau slide tạo tay, có liên kết và không lặp ở cột Tiêu điểm', async ({ page }) => {
  await setHomepage({ hero: 'portal' })
  await sql(`update public.news set show_on_slider = true where slug = $1`, [STEM])
  await page.goto('/')
  const slider = page.getByRole('region', { name: 'Ảnh nổi bật' })
  const slide = slider.getByRole('group', { name: /^5\/5: Câu lạc bộ STEM ra mắt/, includeHidden: true })
  await expect(slide).toHaveCount(1)
  await slider.getByRole('button', { name: 'Tạm dừng tự chạy' }).click()
  await slider.getByRole('button', { name: 'Chuyển tới ảnh 5' }).click()
  await expect(
    slide.getByRole('link', { name: 'Xem chi tiết' }).or(slide.getByRole('heading')),
  ).not.toHaveCount(0)
  await expect(
    page
      .locator(`main a[href="/tin-tuc/${STEM}"]:not([aria-label])`)
      .filter({ hasText: 'Câu lạc bộ STEM ra mắt' }),
  ).toHaveCount(0)
})

test('bài chưa đăng hoặc thiếu ảnh không lên slide', async ({ page }) => {
  await sql(
    `insert into public.news (title, slug, content, thumbnail_url, category_id, author_id, status, show_on_slider, published_at)
     values ('E2E slide nháp', $1, '<p>x</p>', 'seed/slide-stem-rsw.jpg', $3, $4, 'draft', true, null),
            ('E2E slide không ảnh', $2, '<p>x</p>', null, $3, $4, 'published', true, now())`,
    [`e2e-slide-nhap-${uniqueSuffix()}`, `e2e-slide-khong-anh-${uniqueSuffix()}`, CATEGORY, AUTHOR],
  )
  await page.goto('/')
  const slider = page.getByRole('region', { name: 'Ảnh nổi bật' })
  await expect(slider.getByRole('group', { name: /^1\/4/, includeHidden: true })).toHaveCount(1)
  await expect(slider.getByRole('group', { name: /E2E slide/, includeHidden: true })).toHaveCount(0)
})

test('công tắc tự lấy tin: tắt thì không có slide, bật thì lấy tin mới nhất có ảnh', async ({ page }) => {
  await sql(`update public.homepage_slides set is_active = false where is_active`)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Thông báo', level: 2 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ảnh nổi bật' })).toHaveCount(0)

  await setHomepage({ slide_auto_latest: true, slide_news_limit: 3 })
  await page.goto('/')
  const slider = page.getByRole('region', { name: 'Ảnh nổi bật' })
  await expect(slider.getByRole('group', { name: /^1\/3/ })).toBeVisible()
})

test('soạn bài: tick mà thiếu ảnh thì báo, có ảnh thì lưu được; biên tập viên không thấy ô này', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.use.isMobile === true, 'Luồng quản trị kiểm tra trên desktop')
  const slug = `e2e-slide-soan-${uniqueSuffix()}`
  const [row] = await sql<{ id: string }>(
    `insert into public.news (title, slug, content, category_id, author_id, status)
     values ('E2E slide soạn', $1, '<p>x</p>', $2, $3, 'draft') returning id`,
    [slug, CATEGORY, AUTHOR],
  )
  await login(page, 'admin@demo.local', `/admin/tin-tuc/${row!.id}`)
  await page.getByLabel('Hiển thị trên slide').check()
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'phải có ảnh đại diện' })).toBeVisible()
  expect((await sql(`select 1 from public.news where id = $1 and show_on_slider`, [row!.id])).length).toBe(0)

  await sql(`update public.news set thumbnail_url = 'seed/slide-stem-rsw.jpg' where id = $1`, [row!.id])
  await page.reload()
  await page.getByLabel('Hiển thị trên slide').check()
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect
    .poll(
      async () => (await sql(`select 1 from public.news where id = $1 and show_on_slider`, [row!.id])).length,
    )
    .toBe(1)

  const context = await browser.newContext({ baseURL: info.project.use.baseURL })
  const editor = await context.newPage()
  await login(editor, 'editor@demo.local', '/admin/tin-tuc/moi')
  await expect(editor.getByLabel('Tiêu đề').first()).toBeVisible()
  await expect(editor.getByLabel('Hiển thị trên slide')).toHaveCount(0)
  await context.close()
})
