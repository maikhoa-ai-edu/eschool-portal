import { Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/cn'
import { safeExternalUrl } from './settings'
import { useSite } from './site-context'

/** lucide không còn logo thương hiệu nên tự vẽ. */
const PATHS: Record<string, string> = {
  Facebook:
    'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.88v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z',
  YouTube:
    'M23.5 6.2a3 3 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z',
  TikTok:
    'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.89-2.89c.3 0 .59.05.86.13V9.4a6.34 6.34 0 1 0 5.48 6.27V8.73a8.18 8.18 0 0 0 4.77 1.52V6.81c-.33 0-.66-.04-1-.12Z',
}

function Brand({ name, className }: { name: string; className: string }) {
  if (name === 'Zalo') {
    return (
      <span className={cn(className, 'flex items-center justify-center font-black leading-none')} aria-hidden>
        Z
      </span>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Icon các kênh đã khai ở Thông tin trường; kênh để trống không hiện. */
export function SocialLinks({ size, withContact = false }: { size: 'sm' | 'md'; withContact?: boolean }) {
  const { identity } = useSite()
  const channels = (
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
  const phone = withContact ? identity.phone.replace(/[^\d+]/g, '') : ''
  const email = withContact ? identity.email : ''
  if (channels.length === 0 && !phone && !email) return null

  const icon = size === 'sm' ? 'h-3.5 w-3.5 text-[11px]' : 'h-4 w-4 text-sm'
  const link = cn(
    'flex items-center justify-center rounded-full hover:text-white',
    size === 'sm' ? 'h-6 w-6 hover:bg-white/15' : 'h-9 w-9 border border-white/30 hover:bg-white/10',
  )
  return (
    <ul className="flex items-center gap-1.5">
      {phone && (
        <li>
          <a href={`tel:${phone}`} aria-label="Gọi điện thoại" title={identity.phone} className={link}>
            <Phone className={icon} aria-hidden />
          </a>
        </li>
      )}
      {email && (
        <li>
          <a href={`mailto:${email}`} aria-label="Gửi email" title={email} className={link}>
            <Mail className={icon} aria-hidden />
          </a>
        </li>
      )}
      {channels.map(({ name, url }) => (
        <li key={name}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            className={link}
          >
            <Brand name={name} className={icon} />
          </a>
        </li>
      ))}
    </ul>
  )
}
