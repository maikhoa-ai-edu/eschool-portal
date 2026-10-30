import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
} from '@/components/content/PublicPage'
import { RichContent } from '@/components/content/RichContent'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { usePageTitle } from '@/lib/use-page-title'
import { asPageTemplate, fetchPublicPage, PAGES_KEY } from '../api'

function ContactCard() {
  const { identity } = useSite()
  const rows = [
    { icon: MapPin, label: 'Địa chỉ', value: identity.address },
    {
      icon: Phone,
      label: 'Điện thoại',
      value: identity.phone,
      href: `tel:${identity.phone.replace(/[^\d+]/g, '')}`,
    },
    { icon: Mail, label: 'Email', value: identity.email, href: `mailto:${identity.email}` },
    { icon: UserRound, label: 'Hiệu trưởng', value: identity.principal },
  ].filter((r) => r.value)
  return (
    <SidebarBox title={identity.school_name}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nhà trường chưa cập nhật thông tin liên hệ.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex gap-2.5">
              <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block text-xs text-muted">{r.label}</span>
                {r.href ? (
                  <a href={r.href} className="font-medium hover:text-primary">
                    {r.value}
                  </a>
                ) : (
                  <span className="font-medium">{r.value}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SidebarBox>
  )
}

export function StaticPage() {
  const { slug = '' } = useParams()
  const {
    data: page,
    isPending,
    error,
  } = useQuery({
    queryKey: [...PAGES_KEY, 'public', slug],
    queryFn: () => fetchPublicPage(slug),
  })
  usePageTitle(page?.meta_title || page?.title)

  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!page) return <NotFound />
  const template = asPageTemplate(page.template)

  const body = (
    <article className="rounded-xl bg-surface p-4 shadow-sm sm:p-6">
      <PublicPageHeader title={page.title} crumbs={[{ label: page.title }]} />
      {page.featured_image_url && (
        <img src={page.featured_image_url} alt="" className="mb-5 max-h-96 w-full rounded-lg object-cover" />
      )}
      <RichContent html={page.content} />
    </article>
  )

  return (
    <div className={cn(template === 'default' && 'mx-auto max-w-4xl')}>
      {page.status !== 'published' && <DraftPreviewNotice />}
      {template === 'contact' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {body}
          <aside>
            <ContactCard />
          </aside>
        </div>
      ) : (
        body
      )}
    </div>
  )
}
