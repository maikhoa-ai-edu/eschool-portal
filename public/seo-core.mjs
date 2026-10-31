/**
 * Thẻ OG từng bài, sitemap, robots: phần lõi dùng chung cho Vercel Function (api/seo.mjs) và máy chủ Node (server.mjs).
 * public/seo.php là bản tương đương cho hosting PHP; sửa ở đây thì sửa cả ở đó (scripts/test-seo.ts kiểm tra cả hai).
 *
 * Chỉ đọc bằng khóa anon, luôn lọc status=published: RLS và bộ lọc này giữ bản nháp không lộ ra ngoài.
 * Lỗi kết nối CSDL thì vẫn trả trang bình thường, chỉ thiếu thẻ riêng.
 */

const SLUG = '[a-z0-9-]+'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const SEO_ROUTES = [
  {
    prefix: '/tin-tuc/',
    key: 'slug',
    format: SLUG,
    table: 'news',
    module: 'news',
    type: 'article',
    columns: 'title,excerpt,thumbnail_url,updated_at',
    list: 'slug,updated_at',
    title: 'title',
    description: 'excerpt',
    image: 'thumbnail_url',
  },
  {
    prefix: '/thong-bao/',
    key: 'id',
    format: UUID,
    table: 'announcements',
    module: 'announcements',
    type: 'article',
    columns: 'title,content,updated_at',
    list: 'id,updated_at',
    title: 'title',
    description: 'content',
  },
  {
    prefix: '/van-ban/',
    key: 'id',
    format: UUID,
    table: 'documents',
    module: 'documents',
    type: 'article',
    columns: 'title,excerpt,updated_at',
    list: 'id,updated_at',
    title: 'title',
    description: 'excerpt',
  },
  {
    prefix: '/thu-vien-anh/',
    key: 'slug',
    format: SLUG,
    table: 'albums',
    module: 'albums',
    type: 'website',
    columns: 'title,description,updated_at,cover:media!albums_cover_media_id_fkey(file_path)',
    list: 'slug,updated_at',
    title: 'title',
    description: 'description',
  },
  {
    prefix: '/trang/',
    key: 'slug',
    format: SLUG,
    table: 'pages',
    module: 'pages',
    type: 'website',
    columns: 'title,meta_title,meta_description,excerpt,featured_image_url,no_index,updated_at',
    list: 'slug,updated_at',
    filter: 'no_index=eq.false',
    title: 'title',
    description: 'excerpt',
    image: 'featured_image_url',
  },
  {
    prefix: '/chuyen-de/',
    key: 'slug',
    format: SLUG,
    table: 'topics',
    module: 'topics',
    type: 'website',
    columns: 'title,meta_title,meta_description,summary,hero_image,no_index,updated_at',
    list: 'slug,updated_at',
    filter: 'no_index=eq.false',
    title: 'title',
    description: 'summary',
    image: 'hero_image',
  },
]

const MODULE_PAGES = [
  ['news', '/tin-tuc'],
  ['announcements', '/thong-bao'],
  ['documents', '/van-ban'],
  ['albums', '/thu-vien-anh'],
  ['topics', '/chuyen-de'],
]

const ROBOTS_DISALLOW = [
  '/admin',
  '/install',
  '/dang-nhap',
  '/dang-ky',
  '/quen-mat-khau',
  '/dat-lai-mat-khau',
]
const TIMEOUT_MS = 3000

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Mô tả gọn từ nội dung có thể chứa HTML. */
export function plainText(value, max = 200) {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Ảnh lưu đường dẫn trong bucket media; OG cần địa chỉ đầy đủ. */
export function absoluteImage(value, config, origin) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return origin + value
  const path = value.split('/').map(encodeURIComponent).join('/')
  return `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/media/${path}`
}

async function rest(config, query, fetchImpl) {
  const res = await fetchImpl(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${query}`, {
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json()
}

async function fetchSite(config, fetchImpl) {
  const [settings, modules] = await Promise.all([
    rest(config, 'site_settings?select=key,value&key=in.(school_identity,branding)', fetchImpl),
    rest(config, 'module_settings?select=module_key,is_enabled', fetchImpl),
  ])
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  return {
    identity: byKey.school_identity ?? {},
    branding: byKey.branding ?? {},
    disabled: new Set(modules.filter((m) => !m.is_enabled).map((m) => m.module_key)),
  }
}

function matchRoute(path) {
  for (const route of SEO_ROUTES) {
    if (!path.startsWith(route.prefix)) continue
    const value = path.slice(route.prefix.length)
    if (new RegExp(`^${route.format}$`).test(value)) return { route, value }
  }
  return null
}

/** Ảnh có bản nhỏ (đuôi -rsw/-rsj, xem src/features/media/api.ts) thì để trình duyệt chọn đúng cỡ. */
function preloadTag(url) {
  const mark = /-rs([wj])\.[a-z]+$/i.exec(url)
  if (!mark) return `<link rel="preload" as="image" href="${escapeHtml(url)}" fetchpriority="high" />`
  const ext = mark[1].toLowerCase() === 'w' ? 'webp' : 'jpg'
  const set = [480, 960, 1600].map((w) => `${url.replace(/\.[a-z]+$/i, `.w${w}.${ext}`)} ${w}w`).join(', ')
  return `<link rel="preload" as="image" imagesrcset="${escapeHtml(set)}" imagesizes="(min-width: 1280px) 1248px, calc(100vw - 32px)" fetchpriority="high" />`
}

/** Thay title/description sẵn có của index.html, thêm thẻ OG trước </head>. */
export function injectMeta(html, meta) {
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(meta.siteName)}" />`,
    `<meta property="og:type" content="${escapeHtml(meta.type)}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
  ]
  if (meta.image) tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`)
  if (meta.noindex) tags.push('<meta name="robots" content="noindex" />')
  if (meta.preconnect)
    tags.push(`<link rel="preconnect" href="${escapeHtml(meta.preconnect)}" crossorigin />`)
  if (meta.preload) tags.push(preloadTag(meta.preload))
  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(meta.fullTitle)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', () => `${tags.join('\n    ')}\n  </head>`)
}

/** Trang HTML kèm thẻ của đúng bài. Trả về { status, html }. */
export async function renderPage({ path, origin, config, shell, fetchImpl = fetch }) {
  if (!config) return { status: 200, html: shell }
  try {
    const site = await fetchSite(config, fetchImpl)
    const siteName = site.identity.school_name || 'eSchool Portal'
    const base = {
      siteName,
      url: origin + path,
      type: 'website',
      title: siteName,
      fullTitle: siteName,
      description: plainText(site.identity.slogan) || siteName,
      image: absoluteImage(site.branding.banner_url || site.branding.logo_url, config, origin),
      noindex: false,
      preconnect: new URL(config.supabaseUrl).origin,
      preload: null,
    }
    const hit = matchRoute(path)
    if (!hit) {
      if (path === '/') {
        const slides = await rest(
          config,
          'homepage_slides?select=image_path&is_active=eq.true&order=sort_order&limit=1',
          fetchImpl,
        )
        base.preload = absoluteImage(slides[0]?.image_path, config, origin)
      }
      return { status: 200, html: injectMeta(shell, base) }
    }

    const { route, value } = hit
    const rows = site.disabled.has(route.module)
      ? []
      : await rest(
          config,
          `${route.table}?select=${route.columns}&${route.key}=eq.${value}&status=eq.published&limit=1`,
          fetchImpl,
        )
    const row = rows[0]
    // Khách không đọc được (nháp, đã gỡ): 404 cho máy tìm kiếm; nhân sự đăng nhập vẫn xem trước vì ứng dụng tự tải lại dữ liệu
    if (!row) return { status: 404, html: injectMeta(shell, { ...base, noindex: true }) }

    const title = row.meta_title || row[route.title]
    return {
      status: 200,
      html: injectMeta(shell, {
        ...base,
        type: route.type,
        title,
        fullTitle: `${title} | ${siteName}`,
        description: plainText(row.meta_description || row[route.description]) || base.description,
        image:
          absoluteImage(row.cover?.file_path ?? (route.image ? row[route.image] : null), config, origin) ??
          base.image,
        noindex: row.no_index === true,
      }),
    }
  } catch {
    return { status: 200, html: shell }
  }
}

export async function renderSitemap({ origin, config, fetchImpl = fetch }) {
  const urls = [{ loc: `${origin}/` }]
  if (config) {
    try {
      const site = await fetchSite(config, fetchImpl)
      for (const [module, path] of MODULE_PAGES) {
        if (!site.disabled.has(module)) urls.push({ loc: origin + path })
      }
      const routes = SEO_ROUTES.filter((r) => !site.disabled.has(r.module))
      const lists = await Promise.all(
        routes.map((r) =>
          rest(
            config,
            `${r.table}?select=${r.list}&status=eq.published${r.filter ? `&${r.filter}` : ''}&order=updated_at.desc`,
            fetchImpl,
          ),
        ),
      )
      routes.forEach((r, i) => {
        for (const row of lists[i]) {
          urls.push({ loc: origin + r.prefix + row[r.key], lastmod: String(row.updated_at).slice(0, 10) })
        }
      })
    } catch {
      // CSDL lỗi: vẫn trả sitemap hợp lệ gồm trang chủ
    }
  }
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function renderRobots(origin) {
  const rules = ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`).join('\n')
  return `User-agent: *\n${rules}\n\nSitemap: ${origin}/sitemap.xml\n`
}
