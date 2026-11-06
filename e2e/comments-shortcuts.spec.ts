import { expect, test } from '@playwright/test'
import { sql } from './db.ts'
import { login, otherMachine } from './helpers.ts'

/** Đợt 2 của 0.14.0: bình luận kiểu Facebook, nút quản trị trên trang công khai, tác giả sửa bài đã đăng. */
test.describe('bình luận, nút quản trị, tác giả sửa bài', () => {
  test.skip(({ isMobile }) => isMobile, 'Luồng đăng nhập kiểm tra trên desktop')

  test('thích và trả lời bình luận; trả lời chờ duyệt', async ({ page }) => {
    const [target] = await sql<{ slug: string; author_name: string }>(`
      select n.slug, c.author_name from public.news_comments c join public.news n on n.id = c.news_id
      where c.status = 'approved' and c.parent_id is null order by c.created_at limit 1`)
    const text = `E2E trả lời ${Date.now()}`
    try {
      await login(page, 'editor@demo.local', `/tin-tuc/${target!.slug}`)
      const likeButton = page
        .getByRole('button', { name: `Thích bình luận của ${target!.author_name}` })
        .first()
      await likeButton.click()
      await expect(likeButton).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByText('lượt thích').first()).toBeAttached()

      await page
        .getByRole('button', { name: `Trả lời ${target!.author_name}` })
        .first()
        .click()
      await page.getByRole('textbox', { name: `Trả lời ${target!.author_name}` }).fill(text)
      await page.getByRole('button', { name: 'Gửi trả lời' }).click()
      await expect(page.getByText('Bình luận sẽ hiện sau khi được duyệt')).toBeVisible()
      const reply = page.getByRole('listitem').filter({ hasText: text })
      await expect(reply.getByText('Chờ duyệt')).toBeVisible()

      await likeButton.click()
      await expect(likeButton).toHaveAttribute('aria-pressed', 'false')
    } finally {
      await sql(`delete from public.news_comments where content = $1`, [text])
      await sql(
        `delete from public.news_comment_likes where user_id = (select id from public.profiles where email = 'editor@demo.local')`,
      )
    }
  })

  test('khách không thấy nút quản trị; quản trị và tác giả thấy đúng nút', async ({
    page,
    browser,
  }, info) => {
    await page.goto('/tin-tuc/nguoi-lai-do-tham-lang')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Quản trị nhanh' })).toHaveCount(0)

    const admin = await otherMachine(browser, info)
    try {
      await login(admin, 'admin@demo.local', '/tin-tuc/nguoi-lai-do-tham-lang')
      const bar = admin.getByRole('navigation', { name: 'Quản trị nhanh' })
      await expect(bar.getByRole('link', { name: 'Sửa bài này' })).toHaveAttribute(
        'href',
        '/admin/tin-tuc/00000000-0000-0000-0000-0000000000f2',
      )
      await expect(bar.getByRole('link', { name: 'Bảng xếp hạng' })).toBeVisible()
      await admin.goto('/thong-bao')
      await expect(
        admin
          .getByRole('navigation', { name: 'Quản trị nhanh' })
          .getByRole('link', { name: 'Thêm thông báo' }),
      ).toHaveAttribute('href', '/admin/thong-bao/moi')
    } finally {
      await admin.context().close()
    }

    // Tác giả của bài dự thi đã đăng: không có nút sửa, vẫn viết được bài mới
    await login(page, 'editor@demo.local', '/tin-tuc/nguoi-lai-do-tham-lang')
    const bar = page.getByRole('navigation', { name: 'Quản trị nhanh' })
    await expect(bar.getByRole('link', { name: 'Viết bài mới' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Sửa bài này' })).toHaveCount(0)
  })

  test('tác giả sửa bài đã đăng: bài về Chờ duyệt và tạm ẩn', async ({ page, browser }, info) => {
    const slug = `e2e-bai-da-dang-${Date.now()}`
    await sql(
      `insert into public.news (title, slug, content, category_id, author_id, status, published_at)
       select 'E2E Bài đã đăng của giáo viên', $1, '<p>Nội dung cũ</p>', c.id, p.id, 'published', now() - interval '1 hour'
       from public.news_categories c, public.profiles p where p.email = 'editor@demo.local' limit 1`,
      [slug],
    )
    try {
      await login(page, 'editor@demo.local', `/tin-tuc/${slug}`)
      await page
        .getByRole('navigation', { name: 'Quản trị nhanh' })
        .getByRole('link', { name: 'Sửa bài này' })
        .click()
      await expect(page.getByText('Bài đang hiện trên trang công khai')).toBeVisible()
      await page.getByLabel('Tiêu đề', { exact: true }).fill('E2E Bài đã sửa của giáo viên')
      await page.getByRole('button', { name: 'Lưu & gửi duyệt lại' }).click()
      await expect(page.getByText('Đã gửi bài sửa cho quản trị viên duyệt lại')).toBeVisible()
      const [row] = await sql<{ status: string; title: string }>(
        `select status, title from public.news where slug = $1`,
        [slug],
      )
      expect(row).toEqual({ status: 'pending', title: 'E2E Bài đã sửa của giáo viên' })

      const guest = await otherMachine(browser, info)
      try {
        await guest.goto(`/tin-tuc/${slug}`)
        await expect(guest.getByText('Không tìm thấy')).toBeVisible()
      } finally {
        await guest.context().close()
      }
    } finally {
      await sql(`delete from public.news where slug = $1`, [slug])
    }
  })
})
