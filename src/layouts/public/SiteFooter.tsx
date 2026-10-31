import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { fetchMenu, hideDisabledModules, isExternalUrl } from '@/features/site/menu'
import { MenuIcon } from '@/features/site/menu-icons'
import { safeExternalUrl } from '@/features/site/settings'
import { SocialLinks } from '@/features/site/SocialLinks'
import { useSite } from '@/features/site/site-context'
import { fetchVisitStats, VISIT_STATS_KEY } from '@/features/site/visits'
import { cn } from '@/lib/cn'

const numberFormat = new Intl.NumberFormat('vi-VN')
const CURRENT_YEAR = new Date().getFullYear()

export function SiteFooter() {
  const { identity, chrome, isModuleEnabled } = useSite()
  const { data: footerMenu = [] } = useQuery({
    queryKey: ['menu', 'footer'],
    queryFn: () => fetchMenu('footer'),
  })
  const quickLinks = hideDisabledModules(footerMenu, isModuleEnabled)
  const { data: visits } = useQuery({ queryKey: VISIT_STATS_KEY, queryFn: fetchVisitStats })

  const socials = [
    ['Facebook', safeExternalUrl(identity.facebook_url)],
    ['YouTube', safeExternalUrl(identity.youtube_url)],
    ['Zalo', safeExternalUrl(identity.zalo_url)],
  ].filter((s): s is [string, string] => Boolean(s[1]))

  return (
    <footer className="mt-12 bg-primary text-sm text-white/85">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <section aria-labelledby="footer-school">
          <h2 id="footer-school" className="mb-3 text-base font-bold uppercase text-white">
            {identity.school_name}
          </h2>
          <ul className="space-y-2">
            {identity.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {identity.address}
              </li>
            )}
            {identity.phone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <a href={`tel:${identity.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
                  {identity.phone}
                </a>
              </li>
            )}
            {identity.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <a href={`mailto:${identity.email}`} className="hover:text-white">
                  {identity.email}
                </a>
              </li>
            )}
            {identity.principal && (
              <li className="flex gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> Hiệu trưởng:{' '}
                {identity.principal}
              </li>
            )}
            {chrome.footer_info_lines.map((line, i) => (
              <li key={`${i}-${line.text}`} className="flex gap-2">
                <MenuIcon name={line.icon} className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {line.url ? (
                  <a
                    href={line.url}
                    {...(isExternalUrl(line.url) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="hover:text-white"
                  >
                    {line.text}
                  </a>
                ) : (
                  line.text
                )}
              </li>
            ))}
          </ul>
        </section>

        {quickLinks.length > 0 && (
          <section aria-labelledby="footer-links">
            <h2 id="footer-links" className="mb-3 text-base font-bold uppercase text-white">
              Liên kết nhanh
            </h2>
            <ul className="space-y-2">
              {quickLinks.map((link) => {
                const label = (
                  <>
                    {chrome.footer_link_icons && (
                      <MenuIcon name={link.icon} className="h-4 w-4 shrink-0 text-accent" />
                    )}
                    {link.title}
                  </>
                )
                const className = cn(
                  'hover:text-white',
                  chrome.footer_link_icons && 'flex items-center gap-2',
                )
                return (
                  <li key={link.id}>
                    {isExternalUrl(link.url) ? (
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className={className}>
                        {label}
                      </a>
                    ) : (
                      <Link to={link.url} className={className}>
                        {label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="footer-connect">
          <h2 id="footer-connect" className="mb-3 text-base font-bold uppercase text-white">
            Kết nối
          </h2>
          {chrome.footer_connect_icons ? (
            <div className="mb-4">
              <SocialLinks size="md" withContact />
            </div>
          ) : (
            socials.length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-2">
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-full border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            )
          )}
          {visits && (
            <p>
              Lượt truy cập:{' '}
              <strong className="font-bold tabular-nums text-accent">
                {numberFormat.format(visits.total)}
              </strong>
              <span className="text-white/60"> · Hôm nay: {numberFormat.format(visits.today)}</span>
            </p>
          )}
        </section>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {CURRENT_YEAR} {identity.school_name} · Thiết kế bởi MVK
      </div>
    </footer>
  )
}
