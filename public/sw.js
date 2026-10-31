/*
 * Service worker của eSchool Portal.
 * - Mã đã băm tên (/assets/*): lấy từ bộ nhớ đệm trước vì tên đổi khi nội dung đổi.
 * - Trang: luôn hỏi mạng trước để luôn thấy bản mới; mất mạng thì hiện /offline.html.
 * - Không đụng tới cấu hình, trình cài đặt, SQL, dữ liệu Supabase (khác tên miền nên không qua nhánh này).
 */
const CACHE = 'eschool-v1'
const OFFLINE = '/offline.html'
const BYPASS = /^\/(config\.json|install|install\.php|install\.sql|upgrades\/|api\/|sitemap\.xml|robots\.txt)/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || BYPASS.test(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
