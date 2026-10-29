import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ImageUp } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SITE_SETTINGS_QUERY_KEY } from '@/features/site/settings'
import { useSite } from '@/features/site/site-context'
import { applyBranding, schoolInitials } from '@/features/site/theme'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'
import { LOGO_TYPES, mergeSiteSetting, saveModules, uploadLogo } from './api'
import { adjustLightness, COLOR_PRESETS, contrastRatio, HEX_COLOR } from './color'
import { MODULE_INFO } from './steps'
import { StepCard } from './ui'

interface StepProps {
  /** Không có ở bước cấu hình đầu tiên (bước tạo quản trị viên không quay lại được) */
  onBack?: () => void
  onNext: () => void
}

/** Giá trị mặc định trung tính trong CSDL mới (xem migration core), coi như chưa nhập. */
const PLACEHOLDER_SCHOOL_NAME = 'Tên trường'

function useSaveAndContinue(onNext: () => void) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const save = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY })
      onNext()
    } catch (err) {
      setError(toVietnameseError(err))
    }
  }
  return { error, save }
}

function BackButton({ onBack }: { onBack?: () => void }) {
  if (!onBack) return <span />
  return (
    <Button variant="ghost" onClick={onBack}>
      ← Quay lại
    </Button>
  )
}

function NavActions({
  onBack,
  submitting,
  formId,
}: {
  onBack?: () => void
  submitting: boolean
  formId: string
}) {
  return (
    <>
      <BackButton onBack={onBack} />
      <Button type="submit" form={formId} loading={submitting}>
        Lưu và tiếp tục
      </Button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Bước 6: thông tin nhà trường
// ---------------------------------------------------------------------------

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Liên kết phải bắt đầu bằng https://')

const schoolSchema = z.object({
  school_name: z.string().trim().min(3, 'Vui lòng nhập tên trường'),
  short_name: z.string().trim(),
  governing_body: z.string().trim(),
  principal: z.string().trim(),
  address: z.string().trim(),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s.+()-]*$/, 'Số điện thoại không hợp lệ'),
  email: z.union([z.literal(''), z.email('Email không hợp lệ')]),
  facebook_url: optionalUrl,
  youtube_url: optionalUrl,
  zalo_url: optionalUrl,
})
type SchoolValues = z.infer<typeof schoolSchema>

export function SchoolInfoStep({ onBack, onNext }: StepProps) {
  const { identity } = useSite()
  const { error, save } = useSaveAndContinue(onNext)
  const form = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      school_name: identity.school_name === PLACEHOLDER_SCHOOL_NAME ? '' : identity.school_name,
      short_name: identity.short_name,
      governing_body: identity.governing_body,
      principal: identity.principal,
      address: identity.address,
      phone: identity.phone,
      email: identity.email,
      facebook_url: identity.facebook_url,
      youtube_url: identity.youtube_url,
      zalo_url: identity.zalo_url,
    },
  })
  const e = form.formState.errors

  return (
    <StepCard
      title="Thông tin nhà trường"
      description="Hiển thị ở đầu trang, chân trang và tiêu đề website. Có thể sửa lại bất cứ lúc nào trong trang quản trị."
      actions={<NavActions onBack={onBack} submitting={form.formState.isSubmitting} formId="school-form" />}
    >
      <form
        id="school-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => save(() => mergeSiteSetting('school_identity', values)))}
      >
        {error && <Alert tone="danger" title={error} />}
        <Field
          label="Tên trường (đầy đủ)"
          placeholder="Trường THCS & THPT ..."
          error={e.school_name?.message}
          {...form.register('school_name')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tên ngắn"
            hint="Dùng ở chỗ hẹp, vd trên điện thoại."
            error={e.short_name?.message}
            {...form.register('short_name')}
          />
          <Field
            label="Cơ quan chủ quản"
            placeholder="Sở Giáo dục và Đào tạo ..."
            error={e.governing_body?.message}
            {...form.register('governing_body')}
          />
        </div>
        <Field label="Địa chỉ" error={e.address?.message} {...form.register('address')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Hiệu trưởng" error={e.principal?.message} {...form.register('principal')} />
          <Field label="Điện thoại" type="tel" error={e.phone?.message} {...form.register('phone')} />
          <Field label="Email liên hệ" type="email" error={e.email?.message} {...form.register('email')} />
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold text-text">Mạng xã hội (không bắt buộc)</legend>
          <Field
            label="Facebook"
            placeholder="https://facebook.com/..."
            error={e.facebook_url?.message}
            {...form.register('facebook_url')}
          />
          <Field
            label="YouTube"
            placeholder="https://youtube.com/..."
            error={e.youtube_url?.message}
            {...form.register('youtube_url')}
          />
          <Field
            label="Zalo"
            placeholder="https://zalo.me/..."
            error={e.zalo_url?.message}
            {...form.register('zalo_url')}
          />
        </fieldset>
      </form>
    </StepCard>
  )
}

// ---------------------------------------------------------------------------
// Bước 7: logo, màu sắc, khẩu hiệu
// ---------------------------------------------------------------------------

export function BrandingStep({ onBack, onNext }: StepProps) {
  const site = useSite()
  const { error, save } = useSaveAndContinue(onNext)
  const [primary, setPrimary] = useState(site.branding.primary_color)
  const [accent, setAccent] = useState(site.branding.accent_color)
  const [logoUrl, setLogoUrl] = useState(site.branding.logo_url)
  const [slogan, setSlogan] = useState(site.identity.slogan)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const colorsValid = HEX_COLOR.test(primary) && HEX_COLOR.test(accent)
  const lowContrast = colorsValid && contrastRatio(primary, '#ffffff') < 4.5

  // Xem trước màu trên toàn trang; rời bước thì trả về màu đang lưu
  useEffect(() => {
    if (!colorsValid) return
    applyBranding({
      ...site.branding,
      primary_color: primary,
      primary_light_color: adjustLightness(primary, 8),
      accent_color: accent,
    })
  }, [primary, accent, colorsValid, site.branding])
  useEffect(() => () => applyBranding(site.branding), [site.branding])

  const onLogo = async (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      setLogoUrl(await uploadLogo(file))
    } catch (err) {
      setUploadError(toVietnameseError(err))
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!colorsValid) return
    setSubmitting(true)
    await save(async () => {
      await mergeSiteSetting('branding', {
        primary_color: primary.toUpperCase(),
        primary_light_color: adjustLightness(primary, 8).toUpperCase(),
        accent_color: accent.toUpperCase(),
        logo_url: logoUrl,
      })
      await mergeSiteSetting('school_identity', { slogan: slogan.trim() })
    })
    setSubmitting(false)
  }

  return (
    <StepCard
      title="Logo, màu sắc, khẩu hiệu"
      description="Màu chủ đạo dùng cho đầu trang, chân trang và nút bấm; màu nhấn dùng để làm nổi bật."
      actions={
        <>
          <BackButton onBack={onBack} />
          <Button onClick={() => void submit()} loading={submitting} disabled={!colorsValid || uploading}>
            Lưu và tiếp tục
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger" title={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Logo</p>
            <div className="flex items-center gap-4">
              <LogoPreview url={logoUrl} name={site.identity.school_name} className="h-16 w-16 shrink-0" />
              <div className="flex flex-col items-start gap-1">
                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-bg">
                  <ImageUp className="h-4 w-4" aria-hidden />
                  {uploading ? 'Đang tải lên...' : 'Chọn ảnh logo'}
                  <input
                    type="file"
                    accept={LOGO_TYPES.join(',')}
                    className="sr-only"
                    disabled={uploading}
                    onChange={(ev) => void onLogo(ev.target.files?.[0])}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    className="px-1 text-xs font-medium text-muted underline hover:text-danger"
                    onClick={() => setLogoUrl(null)}
                  >
                    Bỏ logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted">
              Ảnh vuông PNG/JPG/WEBP, tối đa 2 MB. Chưa có logo thì hiện chữ viết tắt.
            </p>
            {uploadError && <Alert tone="danger" title={uploadError} />}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Bộ màu gợi ý</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setPrimary(p.primary)
                    setAccent(p.accent)
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                    p.primary.toLowerCase() === primary.toLowerCase()
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border',
                  )}
                >
                  <span className="h-4 w-4 rounded-full" style={{ background: p.primary }} aria-hidden />
                  <span className="h-4 w-4 rounded-full" style={{ background: p.accent }} aria-hidden />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Màu chủ đạo" value={primary} onChange={setPrimary} />
            <ColorField label="Màu nhấn" value={accent} onChange={setAccent} />
          </div>
          {lowContrast && (
            <Alert tone="warning" title="Màu chủ đạo hơi sáng">
              Chữ trắng trên nền màu này khó đọc. Nên chọn màu đậm hơn.
            </Alert>
          )}

          <Field
            label="Khẩu hiệu"
            placeholder="Dạy tốt - Học tốt"
            value={slogan}
            maxLength={120}
            onChange={(ev) => setSlogan(ev.target.value)}
          />
        </div>

        <div aria-label="Xem trước" className="overflow-hidden rounded-xl border border-border">
          <div className="bg-gradient-to-r from-primary to-primary-light p-4 text-white">
            <div className="flex items-center gap-3">
              <LogoPreview url={logoUrl} name={site.identity.school_name} className="h-12 w-12" />
              <div className="min-w-0">
                {site.identity.governing_body && (
                  <p className="truncate text-[11px] uppercase text-white/80">
                    {site.identity.governing_body}
                  </p>
                )}
                <p className="truncate font-bold uppercase">{site.identity.school_name}</p>
                {slogan.trim() && <p className="truncate text-xs italic text-white/80">{slogan.trim()}</p>}
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-accent" />
          <div className="space-y-3 bg-surface p-4">
            <p className="text-sm font-bold text-primary">Tin tức mới nhất</p>
            <div className="h-2 w-3/4 rounded bg-border" />
            <div className="h-2 w-1/2 rounded bg-border" />
            <span className="inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              Xem thêm
            </span>
          </div>
        </div>
      </div>
    </StepCard>
  )
}

function LogoPreview({ url, name, className }: { url: string | null; name: string; className?: string }) {
  if (url) {
    return (
      <img src={url} alt="Logo đã chọn" className={cn('rounded-full bg-white object-contain', className)} />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full border-2 border-accent bg-white font-bold text-primary',
        className,
      )}
    >
      {schoolInitials(name)}
    </span>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const valid = HEX_COLOR.test(value)
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="color"
            value={valid ? value.toLowerCase() : '#000000'}
            onChange={(ev) => onChange(ev.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded border border-border bg-surface p-1"
            aria-label={`${label} (bảng màu)`}
          />
          <input
            value={value}
            onChange={(ev) => onChange(ev.target.value.trim())}
            maxLength={7}
            spellCheck={false}
            aria-invalid={!valid}
            className={cn(
              'h-10 w-full min-w-0 rounded-lg border bg-surface px-3 font-mono text-sm uppercase',
              valid ? 'border-border' : 'border-danger',
            )}
          />
        </div>
      </label>
      {!valid && <p className="text-xs text-danger">Mã màu dạng #RRGGBB</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bước 8: chọn module
// ---------------------------------------------------------------------------

export function ModulesStep({ onBack, onNext }: StepProps) {
  const { modules } = useSite()
  const { error, save } = useSaveAndContinue(onNext)
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => ({ ...modules }))
  const [submitting, setSubmitting] = useState(false)
  const keys = Object.keys(MODULE_INFO).filter((k) => k in modules)

  const submit = async () => {
    setSubmitting(true)
    const changes = Object.fromEntries(
      keys.filter((k) => enabled[k] !== modules[k]).map((k) => [k, Boolean(enabled[k])]),
    )
    await save(() => saveModules(changes))
    setSubmitting(false)
  }

  return (
    <StepCard
      title="Chọn module sử dụng"
      description="Module tắt sẽ ẩn khỏi trang công khai và trang quản trị. Dữ liệu vẫn được giữ, bật lại lúc nào cũng được."
      actions={
        <>
          <BackButton onBack={onBack} />
          <Button onClick={() => void submit()} loading={submitting}>
            Lưu và tiếp tục
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger" title={error} />}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {keys.map((key) => {
          const info = MODULE_INFO[key]!
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-bg">
                <input
                  type="checkbox"
                  checked={Boolean(enabled[key])}
                  onChange={(ev) => setEnabled((prev) => ({ ...prev, [key]: ev.target.checked }))}
                  className="mt-0.5 h-5 w-5 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-text">{info.label}</span>
                  <span className="block text-sm text-muted">{info.description}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </StepCard>
  )
}
