import { safeExternalUrl } from './settings'
import { useSite } from './site-context'

/** Các kênh đã khai ở Thông tin trường; kênh để trống hoặc địa chỉ không an toàn bị bỏ. */
export function useSocialChannels() {
  const { identity } = useSite()
  return (
    [
      ['Facebook', identity.facebook_url],
      ['Zalo', identity.zalo_url],
      ['YouTube', identity.youtube_url],
      ['TikTok', identity.tiktok_url],
    ] as const
  ).flatMap(([name, raw]) => {
    const url = safeExternalUrl(raw)
    return url ? [{ name, url }] : []
  })
}
