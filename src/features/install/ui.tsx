import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Info, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { INSTALL_STEPS, TOTAL_STEPS } from './steps'

/** Khung chung: danh sách bước bên trái (màn hình rộng), thanh tiến độ ở trên (điện thoại). */
export function WizardShell({ current, children }: { current: number; children: ReactNode }) {
  const done = current > TOTAL_STEPS
  const title = INSTALL_STEPS[Math.min(current, TOTAL_STEPS) - 1]

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">eSchool Portal</p>
            <p className="text-lg font-bold">Cài đặt cổng thông tin</p>
          </div>
          {!done && (
            <p className="text-sm text-white/80">
              Bước {current}/{TOTAL_STEPS}
            </p>
          )}
        </div>
        {!done && (
          <div className="h-1 bg-white/20 md:hidden" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${(current / TOTAL_STEPS) * 100}%` }} />
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-4 py-6 md:py-10">
        <nav aria-label="Các bước cài đặt" className="hidden w-60 shrink-0 md:block">
          <ol className="space-y-1">
            {INSTALL_STEPS.map((step, i) => {
              const n = i + 1
              const state = n < current ? 'done' : n === current ? 'current' : 'todo'
              return (
                <li
                  key={step}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    state === 'current' && 'bg-surface font-semibold text-primary shadow-sm',
                    state === 'todo' && 'text-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      state === 'done' && 'bg-success text-white',
                      state === 'current' && 'bg-primary text-white',
                      state === 'todo' && 'border border-border bg-surface',
                    )}
                  >
                    {state === 'done' ? <Check className="h-3.5 w-3.5" aria-label="Đã xong" /> : n}
                  </span>
                  {step}
                </li>
              )
            })}
          </ol>
        </nav>

        <main className="min-w-0 flex-1">
          {!done && title && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent md:hidden">
              Bước {current}: {title}
            </p>
          )}
          {children}
        </main>
      </div>

      <footer className="py-6 text-center text-xs text-muted">eSchool Portal · Thiết kế bởi MVK</footer>
    </div>
  )
}

export function StepCard({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-primary sm:text-2xl">{title}</h1>
      {description && <div className="mt-2 text-sm text-muted">{description}</div>}
      {children && <div className="mt-6 space-y-5">{children}</div>}
      {actions && (
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {actions}
        </div>
      )}
    </section>
  )
}

type CheckState = 'ok' | 'warn' | 'fail' | 'info'

const CHECK_ICONS: Record<CheckState, { icon: typeof Info; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-success', label: 'Đạt' },
  warn: { icon: AlertTriangle, className: 'text-accent', label: 'Lưu ý' },
  fail: { icon: XCircle, className: 'text-danger', label: 'Không đạt' },
  info: { icon: Info, className: 'text-primary', label: 'Thông tin' },
}

export function CheckItem({
  state,
  title,
  children,
}: {
  state: CheckState
  title: string
  children?: ReactNode
}) {
  const { icon: Icon, className, label } = CHECK_ICONS[state]
  return (
    <li className="flex gap-3 py-3">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', className)} aria-label={label} />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-text">{title}</p>
        {children && <div className="mt-0.5 text-muted">{children}</div>}
      </div>
    </li>
  )
}

export function CopyButton({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? 'Đã sao chép' : label}
    </Button>
  )
}

/** Một giá trị cần sao chép (biến môi trường, mã...) kèm nút sao chép. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <CopyButton text={value} />
      </div>
      <code className="mt-2 block break-all font-mono text-xs text-text">{value}</code>
    </div>
  )
}

export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-text marker:font-semibold marker:text-primary">
      {children}
    </ol>
  )
}
