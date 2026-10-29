import { Construction } from 'lucide-react'

/** Chỗ giữ chỗ cho chức năng sẽ hoàn thiện ở giai đoạn sau. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Construction className="mx-auto h-10 w-10 text-accent" aria-hidden />
      <h1 className="mt-3 text-xl font-bold text-primary">{title}</h1>
      <p className="mt-2 text-sm text-muted">Chức năng đang được xây dựng (Giai đoạn {phase}).</p>
    </section>
  )
}
