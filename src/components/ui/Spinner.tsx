import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className, label = 'Đang tải' }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-primary', className)}
      aria-label={label}
      role="status"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
