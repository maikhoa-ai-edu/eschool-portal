import { useConfigState } from '@/app/config-state'

const STEPS = [
  'Chào mừng & kiểm tra môi trường',
  'Kết nối cơ sở dữ liệu Supabase',
  'Khởi tạo cơ sở dữ liệu (install.sql)',
  'Lưu cấu hình (config.json)',
  'Thông tin nhà trường',
  'Nhận diện: logo, màu sắc, khẩu hiệu',
  'Chọn module sử dụng',
  'Tạo quản trị viên cấp cao',
  'Hoàn tất',
]

/** Khung trình cài đặt; các bước được hiện thực ở Giai đoạn 3. */
export function InstallPage() {
  const configState = useConfigState()

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">eSchool Portal</p>
      <h1 className="text-2xl font-bold text-primary">Cài đặt hệ thống</h1>
      {configState.status === 'unconfigured' && (
        <p className="mt-2 text-sm text-muted">{configState.reason}. Hãy làm theo các bước dưới đây.</p>
      )}

      <ol className="mt-8 space-y-2">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </main>
  )
}
