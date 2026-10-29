import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-primary/20 bg-primary/5 text-primary', icon: Info },
  success: { box: 'border-success/30 bg-success/5 text-success', icon: CheckCircle2 },
  warning: { box: 'border-accent/30 bg-accent/10 text-text', icon: AlertTriangle },
  danger: { box: 'border-danger/30 bg-danger/5 text-danger', icon: XCircle },
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
}) {
  const { box, icon: Icon } = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', box)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text/80">{children}</div>}
      </div>
    </div>
  )
}
