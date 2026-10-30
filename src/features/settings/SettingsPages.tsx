import { useState, type ComponentType } from 'react'
import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { BrandingStep, ModulesStep, SchoolInfoStep } from '@/features/install/SchoolSteps'

/**
 * Dùng lại đúng biểu mẫu của trình cài đặt (bước 6-8) ở chế độ quản trị: lưu xong ở lại trang và báo thành
 * công. Cấu hình được tải lại ngay nên mọi trang (kể cả trang công khai) đổi theo.
 */
function SettingsPage({
  title,
  description,
  Step,
}: {
  title: string
  description: string
  Step: ComponentType<{ mode: 'admin'; onNext: () => void }>
}) {
  const [savedAt, setSavedAt] = useState<number | null>(null)
  return (
    <div className="max-w-4xl space-y-4">
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <Link
            to="/"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Xem trang công khai <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />
      {savedAt && <Alert key={savedAt} tone="success" title="Đã lưu. Trang công khai đã cập nhật." />}
      <Step mode="admin" onNext={() => setSavedAt(Date.now())} />
    </div>
  )
}

export function SchoolInfoPage() {
  return (
    <SettingsPage
      title="Thông tin trường"
      description="Tên trường, cơ quan chủ quản, địa chỉ, liên hệ và mạng xã hội."
      Step={SchoolInfoStep}
    />
  )
}

export function BrandingPage() {
  return (
    <SettingsPage
      title="Nhận diện"
      description="Logo, màu sắc, khẩu hiệu, ảnh nền đầu trang và biểu tượng tab."
      Step={BrandingStep}
    />
  )
}

export function ModulesPage() {
  return (
    <SettingsPage
      title="Module"
      description="Tắt module thì ẩn khỏi trang công khai, menu và trang quản trị; dữ liệu vẫn được giữ."
      Step={ModulesStep}
    />
  )
}
