<?php
/**
 * eSchool Portal: thẻ OG từng bài, /sitemap.xml, /robots.txt cho hosting PHP (cPanel). .htaccess chuyển các đường dẫn đó về đây.
 * Bản tương đương của seo-core.mjs; sửa ở đây thì sửa cả ở đó (scripts/test-seo.ts kiểm tra cả hai).
 *
 * Chỉ đọc bằng khóa anon, luôn lọc status=published. Lỗi kết nối CSDL thì vẫn trả trang bình thường.
 */

const SEO_SLUG = '[a-z0-9-]+';
const SEO_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function seo_routes(): array
{
    return [
        ['prefix' => '/tin-tuc/', 'key' => 'slug', 'format' => SEO_SLUG, 'table' => 'news', 'module' => 'news', 'type' => 'article',
            'columns' => 'title,excerpt,thumbnail_url,updated_at', 'list' => 'slug,updated_at',
            'title' => 'title', 'description' => 'excerpt', 'image' => 'thumbnail_url'],
        ['prefix' => '/thong-bao/', 'key' => 'id', 'format' => SEO_UUID, 'table' => 'announcements', 'module' => 'announcements', 'type' => 'article',
            'columns' => 'title,content,updated_at', 'list' => 'id,updated_at',
            'title' => 'title', 'description' => 'content'],
        ['prefix' => '/van-ban/', 'key' => 'id', 'format' => SEO_UUID, 'table' => 'documents', 'module' => 'documents', 'type' => 'article',
            'columns' => 'title,excerpt,updated_at', 'list' => 'id,updated_at',
            'title' => 'title', 'description' => 'excerpt'],
        ['prefix' => '/thu-vien-anh/', 'key' => 'slug', 'format' => SEO_SLUG, 'table' => 'albums', 'module' => 'albums', 'type' => 'website',
            'columns' => 'title,description,updated_at,cover:media!albums_cover_media_id_fkey(file_path)', 'list' => 'slug,updated_at',
            'title' => 'title', 'description' => 'description'],
        ['prefix' => '/trang/', 'key' => 'slug', 'format' => SEO_SLUG, 'table' => 'pages', 'module' => 'pages', 'type' => 'website',
            'columns' => 'title,meta_title,meta_description,excerpt,featured_image_url,no_index,updated_at',
            'list' => 'slug,updated_at', 'filter' => 'no_index=eq.false',
            'title' => 'title', 'description' => 'excerpt', 'image' => 'featured_image_url'],
        ['prefix' => '/chuyen-de/', 'key' => 'slug', 'format' => SEO_SLUG, 'table' => 'topics', 'module' => 'topics', 'type' => 'website',
            'columns' => 'title,meta_title,meta_description,summary,hero_image,no_index,updated_at',
            'list' => 'slug,updated_at', 'filter' => 'no_index=eq.false',
            'title' => 'title', 'description' => 'summary', 'image' => 'hero_image'],
    ];
}

function seo_esc(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function seo_plain($value, int $max = 200): string
{
    $text = preg_replace('/<[^>]*>/', ' ', (string) $value);
    $text = str_replace(['&nbsp;', '&amp;'], [' ', '&'], $text);
    $text = trim(preg_replace('/\s+/u', ' ', $text));
    if (mb_strlen($text, 'UTF-8') <= $max) {
        return $text;
    }
    return rtrim(mb_substr($text, 0, $max - 1, 'UTF-8')) . '…';
}

function seo_config(): ?array
{
    $raw = @file_get_contents(__DIR__ . '/config.json');
    $config = $raw === false ? null : json_decode($raw, true);
    return is_array($config) && !empty($config['supabaseUrl']) && !empty($config['supabaseAnonKey']) ? $config : null;
}

function seo_origin(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

/** Gọi REST của Supabase; lỗi thì ném ngoại lệ. Dùng cURL, hosting tắt cURL thì dùng allow_url_fopen. */
function seo_rest(array $config, string $query): array
{
    $url = rtrim($config['supabaseUrl'], '/') . '/rest/v1/' . $query;
    $key = $config['supabaseAnonKey'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 3,
            CURLOPT_HTTPHEADER => ["apikey: $key", "Authorization: Bearer $key"],
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'timeout' => 3,
            'ignore_errors' => true,
            'header' => "apikey: $key\r\nAuthorization: Bearer $key\r\n",
        ]]);
        $body = @file_get_contents($url, false, $context);
        $status = $body === false ? 0 : (int) substr($http_response_header[0] ?? '', 9, 3);
    }
    $rows = is_string($body) ? json_decode($body, true) : null;
    if ($status !== 200 || !is_array($rows)) {
        throw new RuntimeException("Supabase $status");
    }
    return $rows;
}

function seo_site(array $config): array
{
    $settings = seo_rest($config, 'site_settings?select=key,value&key=in.(school_identity,branding)');
    $modules = seo_rest($config, 'module_settings?select=module_key,is_enabled');
    $byKey = array_column($settings, 'value', 'key');
    $disabled = [];
    foreach ($modules as $m) {
        if (!$m['is_enabled']) {
            $disabled[$m['module_key']] = true;
        }
    }
    return [
        'identity' => $byKey['school_identity'] ?? [],
        'branding' => $byKey['branding'] ?? [],
        'disabled' => $disabled,
    ];
}

function seo_image(?string $value, array $config, string $origin): ?string
{
    if (!$value) {
        return null;
    }
    if (preg_match('#^https?://#i', $value)) {
        return $value;
    }
    if ($value[0] === '/') {
        return $origin . $value;
    }
    $path = implode('/', array_map('rawurlencode', explode('/', $value)));
    return rtrim($config['supabaseUrl'], '/') . '/storage/v1/object/public/media/' . $path;
}

/** Ảnh có bản nhỏ (đuôi -rsw/-rsj, xem src/features/media/api.ts) thì để trình duyệt chọn đúng cỡ. */
function seo_preload(string $url): string
{
    if (!preg_match('/-rs([wj])\.[a-z]+$/i', $url, $mark)) {
        return '<link rel="preload" as="image" href="' . seo_esc($url) . '" fetchpriority="high" />';
    }
    $ext = strtolower($mark[1]) === 'w' ? 'webp' : 'jpg';
    $set = implode(', ', array_map(
        fn ($w) => preg_replace('/\.[a-z]+$/i', ".w$w.$ext", $url) . " {$w}w",
        [480, 960, 1600]
    ));
    return '<link rel="preload" as="image" imagesrcset="' . seo_esc($set) . '" imagesizes="(min-width: 1280px) 1248px, calc(100vw - 32px)" fetchpriority="high" />';
}

function seo_inject(string $html, array $meta): string
{
    $tags = [
        '<meta name="description" content="' . seo_esc($meta['description']) . '" />',
        '<link rel="canonical" href="' . seo_esc($meta['url']) . '" />',
        '<meta property="og:site_name" content="' . seo_esc($meta['siteName']) . '" />',
        '<meta property="og:type" content="' . seo_esc($meta['type']) . '" />',
        '<meta property="og:title" content="' . seo_esc($meta['title']) . '" />',
        '<meta property="og:description" content="' . seo_esc($meta['description']) . '" />',
        '<meta property="og:url" content="' . seo_esc($meta['url']) . '" />',
        '<meta name="twitter:card" content="' . ($meta['image'] ? 'summary_large_image' : 'summary') . '" />',
    ];
    if ($meta['image']) {
        $tags[] = '<meta property="og:image" content="' . seo_esc($meta['image']) . '" />';
    }
    if ($meta['noindex']) {
        $tags[] = '<meta name="robots" content="noindex" />';
    }
    if (!empty($meta['preconnect'])) {
        $tags[] = '<link rel="preconnect" href="' . seo_esc($meta['preconnect']) . '" crossorigin />';
    }
    if (!empty($meta['preload'])) {
        $tags[] = seo_preload($meta['preload']);
    }
    $fullTitle = '<title>' . seo_esc($meta['fullTitle']) . '</title>';
    $html = preg_replace_callback('#<title>.*?</title>#s', fn () => $fullTitle, $html, 1);
    $html = preg_replace('#<meta name="description"[^>]*>\s*#', '', $html, 1);
    return str_replace('</head>', implode("\n    ", $tags) . "\n  </head>", $html);
}

function seo_page(string $path, string $origin, ?array $config, string $shell): array
{
    if (!$config) {
        return [200, $shell];
    }
    try {
        $site = seo_site($config);
        $siteName = ($site['identity']['school_name'] ?? '') ?: 'eSchool Portal';
        $base = [
            'siteName' => $siteName,
            'url' => $origin . $path,
            'type' => 'website',
            'title' => $siteName,
            'fullTitle' => $siteName,
            'description' => seo_plain($site['identity']['slogan'] ?? '') ?: $siteName,
            'image' => seo_image(($site['branding']['banner_url'] ?? null) ?: ($site['branding']['logo_url'] ?? null), $config, $origin),
            'noindex' => false,
            'preconnect' => (function () use ($config) {
                $u = parse_url($config['supabaseUrl']);
                return $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
            })(),
            'preload' => null,
        ];
        if ($path === '/') {
            $slides = seo_rest($config, 'homepage_slides?select=image_path&is_active=eq.true&order=sort_order&limit=1');
            $base['preload'] = seo_image($slides[0]['image_path'] ?? null, $config, $origin);
        }
        foreach (seo_routes() as $route) {
            if (strpos($path, $route['prefix']) !== 0) {
                continue;
            }
            $value = substr($path, strlen($route['prefix']));
            if (!preg_match('/^' . $route['format'] . '$/', $value)) {
                continue;
            }
            $rows = isset($site['disabled'][$route['module']]) ? [] : seo_rest(
                $config,
                "{$route['table']}?select={$route['columns']}&{$route['key']}=eq.$value&status=eq.published&limit=1"
            );
            if (!$rows) {
                // Khách không đọc được (nháp, đã gỡ): 404 cho máy tìm kiếm; ứng dụng vẫn chạy để nhân sự xem trước
                return [404, seo_inject($shell, array_merge($base, ['noindex' => true]))];
            }
            $row = $rows[0];
            $title = ($row['meta_title'] ?? '') ?: $row[$route['title']];
            $image = $row['cover']['file_path'] ?? (isset($route['image']) ? ($row[$route['image']] ?? null) : null);
            return [200, seo_inject($shell, array_merge($base, [
                'type' => $route['type'],
                'title' => $title,
                'fullTitle' => "$title | $siteName",
                'description' => seo_plain(($row['meta_description'] ?? '') ?: ($row[$route['description']] ?? '')) ?: $base['description'],
                'image' => seo_image($image, $config, $origin) ?? $base['image'],
                'noindex' => ($row['no_index'] ?? false) === true,
            ]))];
        }
        return [200, seo_inject($shell, $base)];
    } catch (Throwable $e) {
        return [200, $shell];
    }
}

function seo_sitemap(string $origin, ?array $config): string
{
    $urls = [['loc' => "$origin/"]];
    if ($config) {
        try {
            $site = seo_site($config);
            $pages = ['news' => '/tin-tuc', 'announcements' => '/thong-bao', 'documents' => '/van-ban', 'albums' => '/thu-vien-anh', 'topics' => '/chuyen-de'];
            foreach ($pages as $module => $page) {
                if (!isset($site['disabled'][$module])) {
                    $urls[] = ['loc' => $origin . $page];
                }
            }
            foreach (seo_routes() as $route) {
                if (isset($site['disabled'][$route['module']])) {
                    continue;
                }
                $filter = isset($route['filter']) ? '&' . $route['filter'] : '';
                $rows = seo_rest($config, "{$route['table']}?select={$route['list']}&status=eq.published$filter&order=updated_at.desc");
                foreach ($rows as $row) {
                    $urls[] = ['loc' => $origin . $route['prefix'] . $row[$route['key']], 'lastmod' => substr((string) $row['updated_at'], 0, 10)];
                }
            }
        } catch (Throwable $e) {
            // CSDL lỗi: vẫn trả sitemap hợp lệ
        }
    }
    $lines = array_map(function ($u) {
        $lastmod = isset($u['lastmod']) ? "<lastmod>{$u['lastmod']}</lastmod>" : '';
        return '  <url><loc>' . seo_esc($u['loc']) . "</loc>$lastmod</url>";
    }, $urls);
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" . implode("\n", $lines) . "\n</urlset>\n";
}

function seo_robots(string $origin): string
{
    $rules = array_map(fn ($p) => "Disallow: $p", ['/admin', '/install', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau']);
    return "User-agent: *\n" . implode("\n", $rules) . "\n\nSitemap: $origin/sitemap.xml\n";
}

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$origin = seo_origin();
header('X-Content-Type-Options: nosniff');

if ($path === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    echo seo_robots($origin);
    return;
}
if ($path === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo seo_sitemap($origin, seo_config());
    return;
}
[$status, $html] = seo_page($path, $origin, seo_config(), (string) file_get_contents(__DIR__ . '/index.html'));
http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;
