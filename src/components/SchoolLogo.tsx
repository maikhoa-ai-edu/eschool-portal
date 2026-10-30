import { resolveMediaUrl } from '@/features/media/api'
import { useSite } from '@/features/site/site-context'
import { schoolInitials } from '@/features/site/theme'
import { cn } from '@/lib/cn'

/** Logo trường; chưa tải logo thì hiện chữ viết tắt trên nền màu chủ đạo. */
export function SchoolLogo({ className }: { className?: string }) {
  const { identity, branding } = useSite()
  const logo = resolveMediaUrl(branding.logo_url)
  if (logo) {
    return (
      <img
        src={logo}
        alt={`Logo ${identity.school_name}`}
        className={cn('h-14 w-14 rounded-full bg-white object-contain', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent bg-white text-lg font-bold text-primary',
        className,
      )}
    >
      {schoolInitials(identity.school_name)}
    </span>
  )
}
