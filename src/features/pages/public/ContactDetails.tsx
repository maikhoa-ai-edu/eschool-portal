import type { ReactNode } from 'react'
import { Clock, Mail, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react'
import { BrandIcon } from '@/features/site/SocialLinks'
import { useSocialChannels } from '@/features/site/social-channels'
import { useSite } from '@/features/site/site-context'
import { mapEmbedUrl, parseContactLanding, telHref, zaloHref } from '../landing'

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

const iconClass = 'h-5 w-5 shrink-0'
const chip =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary'

/** Các mục thêm của trang bố cục Liên hệ (điện thoại bộ phận, giờ làm việc, kênh khác, bản đồ). Mục trống tự ẩn. */
export function ContactDetails({ landing }: { landing: unknown }) {
  const { identity } = useSite()
  const contact = parseContactLanding(landing)
  const channels = useSocialChannels()
  const departments = contact.departments.filter((d) => d.name.trim())
  const hours = contact.hours.filter((h) => h.label.trim() || h.value.trim())
  const social = contact.show_social ? channels : []
  const map = mapEmbedUrl(contact.map_url)
  if (departments.length === 0 && hours.length === 0 && social.length === 0 && !map) return null

  return (
    <div className="mt-8 space-y-8 border-t border-border pt-6">
      {departments.length > 0 && (
        <Section icon={<Phone className={iconClass} aria-hidden />} title="Điện thoại các bộ phận">
          <ul className="grid gap-3 sm:grid-cols-2">
            {departments.map((d, i) => {
              const tel = telHref(d.phone)
              const zalo = d.zalo ? zaloHref(d.phone) : null
              const email = d.email.includes('@') ? d.email.trim() : ''
              return (
                <li key={i} className="space-y-2 rounded-lg border border-border p-4">
                  <p className="font-semibold">{d.name}</p>
                  {d.note && <p className="text-sm text-muted">{d.note}</p>}
                  <div className="flex flex-wrap gap-2">
                    {tel && (
                      <a href={tel} className={chip}>
                        <Phone className="h-4 w-4 text-accent" aria-hidden />
                        {d.phone}
                      </a>
                    )}
                    {zalo && (
                      <a
                        href={zalo}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Nhắn Zalo ${d.name}`}
                        className={chip}
                      >
                        <MessageCircle className="h-4 w-4 text-accent" aria-hidden />
                        Nhắn Zalo
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className={`${chip} max-w-full`}>
                        <Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span className="truncate">{email}</span>
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {hours.length > 0 && (
        <Section icon={<Clock className={iconClass} aria-hidden />} title="Giờ làm việc">
          <dl className="divide-y divide-border rounded-lg border border-border">
            {hours.map((h, i) => (
              <div key={i} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[12rem_1fr]">
                <dt className="font-medium">{h.label}</dt>
                <dd className="whitespace-pre-line text-muted">{h.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {social.length > 0 && (
        <Section icon={<Share2 className={iconClass} aria-hidden />} title="Kênh liên lạc khác">
          <ul className="flex flex-wrap gap-2">
            {social.map(({ name, url }) => (
              <li key={name}>
                <a href={url} target="_blank" rel="noopener noreferrer" className={chip}>
                  <BrandIcon name={name} className="h-4 w-4 text-sm text-accent" />
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {map && (
        <Section icon={<MapPin className={iconClass} aria-hidden />} title="Bản đồ">
          <iframe
            src={map}
            title={`Bản đồ ${identity.school_name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[4/3] w-full rounded-lg border border-border sm:aspect-video"
          />
        </Section>
      )}
    </div>
  )
}
