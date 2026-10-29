import { useSite } from '@/features/site/site-context'
import { ComingSoon } from '@/components/ComingSoon'

/** Trang chủ tạm; bố cục đầy đủ (tin tiêu điểm, thông báo, văn bản...) làm ở Giai đoạn 5. */
export function HomePage() {
  const { identity } = useSite()
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-accent">Chào mừng đến với</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">{identity.school_name}</h1>
        {identity.slogan && <p className="mt-2 text-muted">{identity.slogan}</p>}
      </section>
      <ComingSoon title="Bố cục trang chủ" phase={5} />
    </div>
  )
}
