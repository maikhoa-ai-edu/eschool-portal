export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

export type ZaloShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

/**
 * Nút chính thức của Zalo phải tải script riêng nên không dùng.
 * Điện thoại: mở bảng chia sẻ của máy để chọn Zalo. Máy tính: chép liên kết để dán vào Zalo.
 */
export async function shareForZalo(
  url: string,
  title: string,
  env: Pick<Navigator, 'share' | 'clipboard'> = navigator,
  isTouch: boolean = window.matchMedia?.('(pointer: coarse)').matches ?? false,
): Promise<ZaloShareResult> {
  if (isTouch && env.share) {
    try {
      await env.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await env.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export async function copyLink(url: string, env: Pick<Navigator, 'clipboard'> = navigator): Promise<boolean> {
  try {
    await env.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}
