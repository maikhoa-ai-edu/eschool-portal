import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-2 focus:outline-primary/20'

function Described({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error)
    return (
      <p id={`${id}-error`} className="text-xs text-danger">
        {error}
      </p>
    )
  if (hint)
    return (
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
    )
  return null
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: ReactNode
}

export function TextareaField({ label, error, hint, className, id, rows = 3, ...props }: TextareaFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(inputId, error, hint)}
        className={cn(CONTROL, 'py-2', error && 'border-danger', className)}
        {...props}
      />
      <Described id={inputId} error={error} hint={hint} />
    </div>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: ReactNode
  options: ReadonlyArray<{ value: string; label: string }>
  /** Dòng đầu tiên không chọn gì (giá trị rỗng) */
  placeholder?: string
}

export function SelectField({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-text">
        {label}
      </label>
      <select
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(inputId, error, hint)}
        className={cn(CONTROL, 'h-10', error && 'border-danger', className)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Described id={inputId} error={error} hint={hint} />
    </div>
  )
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hint?: ReactNode
}

export function CheckboxField({ label, hint, className, id, ...props }: CheckboxFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
        {...props}
      />
      <div>
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
        {hint && (
          <p id={`${inputId}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
