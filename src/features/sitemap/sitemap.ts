import type { MenuNode } from '@/features/site/menu'
import type { ModuleKey } from '@/features/site/settings'

export interface SitemapLink {
  title: string
  url: string
}

const MODULE_PAGES: Array<{ module: ModuleKey; title: string; url: string }> = [
  { module: 'news', title: 'Tin tức', url: '/tin-tuc' },
  { module: 'announcements', title: 'Thông báo', url: '/thong-bao' },
  { module: 'documents', title: 'Văn bản', url: '/van-ban' },
  { module: 'albums', title: 'Thư viện ảnh', url: '/thu-vien-anh' },
  { module: 'videos', title: 'Video', url: '/video' },
  { module: 'resources', title: 'Tài nguyên', url: '/tai-nguyen' },
  { module: 'plans', title: 'Kế hoạch công tác', url: '/ke-hoach' },
  { module: 'topics', title: 'Chuyên đề', url: '/chuyen-de' },
]

function collectUrls(nodes: MenuNode[]): string[] {
  return nodes.flatMap((n) => [n.url, ...collectUrls(n.children)])
}

/** Các trang công khai chưa có trong menu chính, để sơ đồ trang đủ mọi mục đang bật mà không lặp lại. */
export function otherLinks(
  menu: MenuNode[],
  pages: Array<{ title: string; slug: string }>,
  isModuleEnabled: (key: ModuleKey) => boolean,
): SitemapLink[] {
  // Menu trỏ tới trang con của một mục (vd một chuyên đề) cũng tính là đã có mục đó
  const menuUrls = collectUrls(menu)
  const inMenu = (url: string) => menuUrls.some((u) => u === url || u.startsWith(`${url}/`))
  const candidates: SitemapLink[] = [
    ...MODULE_PAGES.filter((p) => isModuleEnabled(p.module)),
    ...(isModuleEnabled('pages') ? pages.map((p) => ({ title: p.title, url: `/trang/${p.slug}` })) : []),
    { title: 'Tìm kiếm', url: '/tim-kiem' },
  ]
  return candidates.filter((link) => !inMenu(link.url)).map(({ title, url }) => ({ title, url }))
}
