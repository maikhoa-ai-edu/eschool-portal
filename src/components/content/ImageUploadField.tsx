import { useId, useRef, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { resolveMediaUrl, uploadImage } from '@/features/media/api'
import { toVietnameseError } from '@/lib/errors'

/** Ô chọn một ảnh (ảnh đại diện bài viết, ảnh trang...): tải lên ngay, trả về đường dẫn trong bucket media. */
export function ImageUploadField({
  label,
  value,
  onChange,
  folder,
  hint,
}: {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  folder: string
  hint?: string
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      onChange((await uploadImage(file, folder)).path)
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-medium text-text">
        {label}
      </p>
      {value ? (
        <img
          src={resolveMediaUrl(value)!}
          alt=""
          className="aspect-video w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-bg text-muted">
          <ImageUp className="h-8 w-8" aria-hidden />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={uploading}
          aria-describedby={id}
          onClick={() => input.current?.click()}
        >
          {value ? 'Đổi ảnh' : 'Chọn ảnh'}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Bỏ ảnh
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void pick(file)
        }}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}
