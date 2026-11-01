import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Network } from 'lucide-react'
import { PublicPageHeader, PublicQueryState } from '@/components/content/PublicPage'
import { fetchPublishedPageLinks, PAGES_KEY } from '@/features/pages/api'
import { fetchMenu, hideDisabledModules, isExternalUrl } from '@/features/site/menu'
import { useSite } from '@/features/site/site-context'
import { usePageTitle } from '@/lib/use-page-title'
import { otherLinks, type SitemapLink } from './sitemap'

function SiteLink({ link, className }: { link: SitemapLink; className?: string }) {
  return isExternalUrl(link.url) ? (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={className}>
      {link.title} <ExternalLink className="inline h-3.5 w-3.5" aria-label="(mở trang ngoài)" />
    </a>
  ) : (
    <Link to={link.url} className={className}>
      {link.title}
    </Link>
  )
}

const cardClass = 'rounded-xl border-2 border-primary/20 bg-surface p-4 shadow-sm'
const headLink = 'font-bold text-primary hover:underline'
const childLink = 'text-sm hover:text-primary hover:underline'

/** Sơ đồ trang: tự sinh từ menu chính, thêm các trang đang bật chưa có trong menu. */
export function SitemapPage() {
  usePageTitle('Sơ đồ trang')
  const { isModuleEnabled } = useSite()
  const menu = useQuery({ queryKey: ['menu', 'main'], queryFn: () => fetchMenu('main') })
  const pages = useQuery({ queryKey: [...PAGES_KEY, 'links'], queryFn: fetchPublishedPageLinks })
  const pending = menu.isPending || pages.isPending
  const error = menu.error ?? pages.error

  const roots = hideDisabledModules(menu.data ?? [], isModuleEnabled)
  const others = otherLinks(roots, pages.data ?? [], isModuleEnabled)

  return (
    <div>
      <PublicPageHeader title="Sơ đồ trang" crumbs={[{ label: 'Sơ đồ trang' }]} />
      <PublicQueryState isPending={pending} error={error} />
      {!pending && !error && (
        <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => (
            <li key={root.id} className={cardClass}>
              <SiteLink link={root} className={headLink} />
              {root.children.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-l-2 border-primary/20 pl-3">
                  {root.children.map((child) => (
                    <li key={child.id}>
                      <SiteLink link={child} className={childLink} />
                      {child.children.length > 0 && (
                        <ul className="mt-1 space-y-1 pl-3">
                          {child.children.map((leaf) => (
                            <li key={leaf.id}>
                              <SiteLink link={leaf} className={childLink} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {others.length > 0 && (
            <li className={cardClass}>
              <p className="flex items-center gap-2 font-bold text-primary">
                <Network className="h-4 w-4" aria-hidden /> Các mục khác
              </p>
              <ul className="mt-2 space-y-1.5 border-l-2 border-primary/20 pl-3">
                {others.map((link) => (
                  <li key={link.url}>
                    <SiteLink link={link} className={childLink} />
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
