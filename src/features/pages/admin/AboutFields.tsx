import { Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { ImageUploadField } from '@/components/content/ImageUploadField'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { TextareaField } from '@/components/ui/FormControls'
import { mapEmbedUrl, type AboutLanding } from '../landing'

/** Các mục của trang bố cục Giới thiệu. Ảnh tập thể trường chính là "Ảnh đầu trang". */
export function AboutFields({
  value,
  onChange,
}: {
  value: AboutLanding
  onChange: (next: AboutLanding) => void
}) {
  const set = (patch: Partial<AboutLanding>) => onChange({ ...value, ...patch })
  const setCoreValue = (index: number, patch: Partial<AboutLanding['core_values'][number]>) =>
    set({ core_values: value.core_values.map((v, i) => (i === index ? { ...v, ...patch } : v)) })
  const mapInvalid = value.map_url.trim() !== '' && !mapEmbedUrl(value.map_url)

  return (
    <Panel title="Nội dung trang Giới thiệu">
      <p className="text-sm text-muted">
        Ảnh tập thể trường là mục “Ảnh đầu trang” ở cột bên. Mục nào để trống sẽ tự ẩn.
      </p>
      <Field
        label="Khẩu hiệu"
        hint="Để trống sẽ dùng khẩu hiệu trong Thông tin trường."
        value={value.tagline}
        maxLength={200}
        onChange={(e) => set({ tagline: e.target.value })}
      />
      <TextareaField
        label="Lịch sử hình thành"
        rows={5}
        value={value.history}
        onChange={(e) => set({ history: e.target.value })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField
          label="Sứ mệnh"
          rows={4}
          value={value.mission}
          onChange={(e) => set({ mission: e.target.value })}
        />
        <TextareaField
          label="Tầm nhìn"
          rows={4}
          value={value.vision}
          onChange={(e) => set({ vision: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Giá trị cốt lõi</p>
        {value.core_values.map((item, i) => (
          <div key={i} className="grid items-start gap-2 md:grid-cols-[14rem_1fr_auto]">
            <Field
              label={`Giá trị ${i + 1}`}
              value={item.title}
              maxLength={80}
              onChange={(e) => setCoreValue(i, { title: e.target.value })}
            />
            <Field
              label={`Mô tả giá trị ${i + 1}`}
              value={item.text}
              maxLength={300}
              onChange={(e) => setCoreValue(i, { text: e.target.value })}
            />
            <Button
              variant="ghost"
              size="sm"
              className="md:mt-7"
              aria-label={`Xóa giá trị ${i + 1}`}
              onClick={() => set({ core_values: value.core_values.filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-4 w-4 text-danger" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => set({ core_values: [...value.core_values, { title: '', text: '' }] })}
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm giá trị
        </Button>
      </div>
      <TextareaField
        label="Khuôn viên"
        rows={3}
        value={value.campus_text}
        onChange={(e) => set({ campus_text: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {value.campus_images.map((path, i) => (
          <ImageUploadField
            key={path}
            label={`Ảnh khuôn viên ${i + 1}`}
            value={path}
            folder="pages"
            onChange={(next) =>
              set({
                campus_images: next
                  ? value.campus_images.map((p, j) => (j === i ? next : p))
                  : value.campus_images.filter((_, j) => j !== i),
              })
            }
          />
        ))}
        <ImageUploadField
          key={value.campus_images.length}
          label="Thêm ảnh khuôn viên"
          value={null}
          folder="pages"
          onChange={(next) => next && set({ campus_images: [...value.campus_images, next] })}
        />
      </div>
      <TextareaField
        label="Bản đồ Google Maps"
        rows={2}
        hint="Trên Google Maps: Chia sẻ, Nhúng bản đồ, sao chép HTML rồi dán vào đây."
        error={mapInvalid ? 'Chỉ nhận link nhúng của Google Maps.' : undefined}
        value={value.map_url}
        onChange={(e) => set({ map_url: e.target.value })}
      />
    </Panel>
  )
}
