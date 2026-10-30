import DOMPurify from 'dompurify'

let hooked = false

/** Liên kết ra ngoài mở tab mới và không cho trang đích điều khiển ngược lại cửa sổ này. */
function addLinkHook() {
  if (hooked) return
  hooked = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? ''
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      } else {
        node.removeAttribute('target')
      }
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy')
    }
  })
}

/**
 * Làm sạch HTML do nhân sự soạn trước khi hiển thị. CSDL lưu nguyên văn nên đây là lớp bảo vệ duy nhất
 * chống chèn mã (script, onerror, javascript:...). Chỉ giữ thẻ định dạng thông thường.
 */
export function sanitizeHtml(html: string): string {
  addLinkHook()
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['id', 'class'],
  })
}

/** Chữ thuần từ HTML (dùng cho mô tả tự sinh). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
