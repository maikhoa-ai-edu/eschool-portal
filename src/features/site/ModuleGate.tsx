import type { ReactNode } from 'react'
import { PauseCircle } from 'lucide-react'
import type { ModuleKey } from './settings'
import { useSite } from './site-context'

/** Trang công khai của module đang tắt hiển thị thông báo thay vì nội dung. */
export function ModuleGate({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { isModuleEnabled } = useSite()
  if (isModuleEnabled(module)) return <>{children}</>
  return (
    <section className="mx-auto max-w-lg py-12 text-center">
      <PauseCircle className="mx-auto h-10 w-10 text-muted" aria-hidden />
      <h1 className="mt-3 text-xl font-bold text-primary">Chức năng tạm ngừng</h1>
      <p className="mt-2 text-sm text-muted">Nhà trường hiện chưa sử dụng chức năng này.</p>
    </section>
  )
}
