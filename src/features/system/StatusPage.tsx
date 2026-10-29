import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Database, Loader2, XCircle } from 'lucide-react'
import { useConfigState } from '@/app/config-state'
import { getSupabase } from '@/lib/supabase'
import { APP_VERSION, REQUIRED_SCHEMA_VERSION } from '@/lib/version'

async function fetchSchemaVersion(): Promise<string> {
  const { data, error } = await getSupabase().rpc('get_schema_version')
  if (error) throw new Error(error.message)
  return String(data)
}

/** Trang kiểm tra tạm thời của Giai đoạn 0; sẽ được thay bằng trang chủ thật. */
export function StatusPage() {
  const configState = useConfigState()
  const schema = useQuery({ queryKey: ['schema-version'], queryFn: fetchSchemaVersion })

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">eSchool Portal</p>
        <h1 className="text-2xl font-bold text-primary">Trạng thái hệ thống</h1>
      </header>

      <dl className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
        <Row label="Phiên bản ứng dụng" value={APP_VERSION} />
        <Row
          label="Nguồn cấu hình"
          value={configState.status === 'configured' ? configState.source : 'chưa cấu hình'}
        />
        <Row
          label="Supabase URL"
          value={configState.status === 'configured' ? configState.config.supabaseUrl : '—'}
        />
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="flex items-center gap-2 text-muted">
            <Database className="h-4 w-4" aria-hidden /> Phiên bản CSDL
          </dt>
          <dd className="flex items-center gap-2 font-medium">
            {schema.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-label="Đang kiểm tra" />}
            {schema.isError && (
              <>
                <XCircle className="h-4 w-4 text-danger" aria-hidden />
                <span className="text-danger">{schema.error.message}</span>
              </>
            )}
            {schema.isSuccess && (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                {schema.data}
                {schema.data !== REQUIRED_SCHEMA_VERSION && (
                  <span className="text-danger">(cần {REQUIRED_SCHEMA_VERSION})</span>
                )}
              </>
            )}
          </dd>
        </div>
      </dl>

      <footer className="mt-12 text-center text-xs text-muted">Thiết kế bởi MVK</footer>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}
