import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/admin/AdminPage'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField, TextareaField } from '@/components/ui/FormControls'
import { mapEmbedUrl, zaloHref, type ContactLanding } from '../landing'

function moved<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const next = [...list]
  ;[next[index], next[index + delta]] = [next[index + delta]!, next[index]!]
  return next
}

function RowButtons({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  label: string
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div className="flex">
      <Button variant="ghost" size="sm" aria-label="Lên" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Xuống"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Xóa ${label}`} onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>
    </div>
  )
}

/** Các mục thêm của trang bố cục Liên hệ. Thông tin chung của trường vẫn lấy từ Thông tin trường. */
export function ContactFields({
  value,
  onChange,
}: {
  value: ContactLanding
  onChange: (next: ContactLanding) => void
}) {
  const set = (patch: Partial<ContactLanding>) => onChange({ ...value, ...patch })
  const setDepartment = (index: number, patch: Partial<ContactLanding['departments'][number]>) =>
    set({ departments: value.departments.map((d, i) => (i === index ? { ...d, ...patch } : d)) })
  const setHour = (index: number, patch: Partial<ContactLanding['hours'][number]>) =>
    set({ hours: value.hours.map((h, i) => (i === index ? { ...h, ...patch } : h)) })
  const mapInvalid = value.map_url.trim() !== '' && !mapEmbedUrl(value.map_url)

  return (
    <Panel title="Nội dung trang Liên hệ">
      <p className="text-sm text-muted">
        Địa chỉ, điện thoại, email chung của trường lấy từ Thông tin trường. Mục nào để trống sẽ tự ẩn. Chỉ
        nhập số máy của bộ phận: số ở đây hiện công khai.
      </p>

      <div className="space-y-3">
        <p className="text-sm font-medium">Điện thoại các bộ phận</p>
        {value.departments.map((d, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="pt-1 text-sm font-medium text-muted">Bộ phận {i + 1}</p>
              <RowButtons
                index={i}
                count={value.departments.length}
                label={`bộ phận ${i + 1}`}
                onMove={(delta) => set({ departments: moved(value.departments, i, delta) })}
                onRemove={() => set({ departments: value.departments.filter((_, j) => j !== i) })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label={`Tên bộ phận ${i + 1}`}
                placeholder="Ví dụ: Văn phòng"
                value={d.name}
                maxLength={120}
                onChange={(e) => setDepartment(i, { name: e.target.value })}
              />
              <Field
                label={`Điện thoại bộ phận ${i + 1}`}
                type="tel"
                value={d.phone}
                maxLength={40}
                onChange={(e) => setDepartment(i, { phone: e.target.value })}
              />
              <Field
                label={`Email bộ phận ${i + 1}`}
                type="email"
                hint="Không bắt buộc."
                value={d.email}
                maxLength={120}
                onChange={(e) => setDepartment(i, { email: e.target.value })}
              />
              <Field
                label={`Ghi chú bộ phận ${i + 1}`}
                hint="Không bắt buộc, ví dụ: tiếp nhận hồ sơ tuyển sinh."
                value={d.note}
                maxLength={200}
                onChange={(e) => setDepartment(i, { note: e.target.value })}
              />
            </div>
            <CheckboxField
              label={`Hiện nút "Nhắn Zalo" cho bộ phận ${i + 1}`}
              hint={
                d.zalo && d.phone.trim() && !zaloHref(d.phone)
                  ? 'Số này không phải số di động 10 chữ số nên nút Zalo sẽ không hiện.'
                  : 'Mở Zalo theo số điện thoại trên. Số đó phải có tài khoản Zalo.'
              }
              checked={d.zalo}
              onChange={(e) => setDepartment(i, { zalo: e.target.checked })}
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              departments: [...value.departments, { name: '', phone: '', email: '', note: '', zalo: false }],
            })
          }
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm bộ phận
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Giờ làm việc</p>
        {value.hours.map((h, i) => (
          <div key={i} className="grid items-start gap-2 md:grid-cols-[14rem_1fr_auto]">
            <Field
              label={`Ngày ${i + 1}`}
              placeholder="Thứ Hai - Thứ Sáu"
              value={h.label}
              maxLength={80}
              onChange={(e) => setHour(i, { label: e.target.value })}
            />
            <Field
              label={`Giờ ${i + 1}`}
              placeholder="Sáng 7h00 - 11h00, chiều 13h30 - 17h00"
              value={h.value}
              maxLength={200}
              onChange={(e) => setHour(i, { value: e.target.value })}
            />
            <div className="md:mt-7">
              <RowButtons
                index={i}
                count={value.hours.length}
                label={`dòng giờ ${i + 1}`}
                onMove={(delta) => set({ hours: moved(value.hours, i, delta) })}
                onRemove={() => set({ hours: value.hours.filter((_, j) => j !== i) })}
              />
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => set({ hours: [...value.hours, { label: '', value: '' }] })}
        >
          <Plus className="h-4 w-4" aria-hidden /> Thêm dòng giờ làm việc
        </Button>
      </div>

      <CheckboxField
        label="Hiện các kênh liên lạc khác"
        hint="Facebook, Zalo, YouTube, TikTok đã khai ở Thông tin trường; kênh để trống không hiện."
        checked={value.show_social}
        onChange={(e) => set({ show_social: e.target.checked })}
      />

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
