import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { fetchMenu, hideDisabledModules, isExternalUrl } from '@/features/site/menu'
import { safeExternalUrl } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { getSupabase } from '@/lib/supabase'

async function fetchVisitStats(): Promise<{ total: number; today: number }> {
  const { data, error } = await getSupabase().rpc('get_visit_stats')
  if (error) throw error
  const stats = data as { total?: number; today?: number } | null
  return { total: Number(stats?.total ?? 0), today: Number(stats?.today ?? 0) }
}

const numberFormat = new Intl.NumberFormat('vi-VN')
const CURRENT_YEAR = new Date().getFullYear()

export function SiteFooter() {
  const { identity, isModuleEnabled } = useSite()
  const { data: footerMenu = [] } = useQuery({
    queryKey: ['menu', 'footer'],
    queryFn: () => fetchMenu('footer'),
  })
  const quickLinks = hideDisabledModules(footerMenu, isModuleEnabled)
  const { data: visits } = useQuery({ queryKey: ['visit-stats'], queryFn: fetchVisitStats })

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
          </ul>
        </section>

        {quickLinks.length > 0 && (
          <section aria-labelledby="footer-links">
            <h2 id="footer-links" className="mb-3 text-base font-bold uppercase text-white">
              Liên kết nhanh
            </h2>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.id}>
                  {isExternalUrl(link.url) ? (
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                      {link.title}
                    </a>
                  ) : (
                    <Link to={link.url} className="hover:text-white">
                      {link.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="footer-connect">
          <h2 id="footer-connect" className="mb-3 text-base font-bold uppercase text-white">
            Kết nối
          </h2>
          {socials.length > 0 && (
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
