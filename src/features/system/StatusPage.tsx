import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { useConfigState } from '@/app/config-state'
import { AdminPageHeader, Panel } from '@/components/admin/AdminPage'
import { useAuth } from '@/features/auth/auth-context'
import { toVietnameseError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase'
import { APP_VERSION, REQUIRED_SCHEMA_VERSION } from '@/lib/version'
import {
  checkAuthSettings,
  checkHealth,
  checkSchemaVersion,
  type AuthSettings,
  type CheckStatus,
  type SystemCheck,
  type SystemHealth,
} from './checks'

async function fetchSchemaVersion(): Promise<string> {
  const { data, error } = await getSupabase().rpc('get_schema_version')
  if (error) throw error
  return String(data)
}

async function fetchStorageCheck(): Promise<SystemCheck> {
  const { error } = await getSupabase().storage.from('media').list('', { limit: 1 })
  if (error) throw error
  return { label: 'Dịch vụ lưu trữ', status: 'ok', detail: 'Đang hoạt động.' }
}

async function fetchHealth(): Promise<SystemHealth> {
  const { data, error } = await getSupabase().rpc('get_system_health')
  if (error) throw error
  return data as unknown as SystemHealth
}

const STATUS_ICONS: Record<CheckStatus, { icon: typeof Info; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-success', label: 'Tốt' },
  warning: { icon: AlertTriangle, className: 'text-accent', label: 'Cần chú ý' },
  error: { icon: XCircle, className: 'text-danger', label: 'Lỗi' },
  info: { icon: Info, className: 'text-muted', label: 'Thông tin' },
}

function CheckRow({ check }: { check: SystemCheck }) {
  const { icon: Icon, className, label } = STATUS_ICONS[check.status]
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-label={label} />
      <dt className="w-44 shrink-0 text-muted">{check.label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{check.detail}</dd>
    </div>
  )
}

/** Một phép kiểm tra lúc đang chạy / lỗi / có kết quả đều chiếm đúng một dòng. */
function QueryRows({
  label,
  query,
  toChecks,
}: {
  label: string
  query: UseQueryResult<unknown>
  toChecks: () => SystemCheck[]
}) {
  if (query.isPending) {
    return (
      <div className="flex items-center gap-3 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang kiểm tra {label.toLowerCase()}…
      </div>
    )
  }
  if (query.isError) {
    return <CheckRow check={{ label, status: 'error', detail: toVietnameseError(query.error) }} />
  }
  return (
    <>
      {toChecks().map((check) => (
        <CheckRow key={check.label} check={check} />
      ))}
    </>
  )
}

/** Kiểm tra thật từng thành phần: nhân sự thấy phần kết nối, SUPER_ADMIN thấy thêm số liệu chi tiết từ CSDL. */
export function StatusPage() {
  const configState = useConfigState()
  const { can } = useAuth()
  const canViewHealth = can('audit.view')
  const configured = configState.status === 'configured' ? configState : null

  const schema = useQuery({ queryKey: ['schema-version'], queryFn: fetchSchemaVersion })
  const storage = useQuery({ queryKey: ['system', 'storage'], queryFn: fetchStorageCheck, retry: false })
  const auth = useQuery({
    queryKey: ['system', 'auth'],
    enabled: Boolean(configured),
    retry: false,
    queryFn: async (): Promise<AuthSettings> => {
      const res = await fetch(`${configured!.config.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: configured!.config.supabaseAnonKey },
      })
      if (!res.ok) throw new Error(`Dịch vụ đăng nhập trả về lỗi ${res.status}`)
      return (await res.json()) as AuthSettings
    },
  })
  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: fetchHealth,
    enabled: canViewHealth,
    retry: false,
  })

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader title="Trạng thái hệ thống" description="Kiểm tra tại thời điểm mở trang." />

      <Panel title="Kết nối">
        <dl className="divide-y divide-border">
          <CheckRow check={{ label: 'Phiên bản ứng dụng', status: 'info', detail: APP_VERSION }} />
          <CheckRow
            check={{ label: 'Nguồn cấu hình', status: 'info', detail: configured?.source ?? 'chưa cấu hình' }}
          />
          <CheckRow
            check={{ label: 'Supabase URL', status: 'info', detail: configured?.config.supabaseUrl ?? '—' }}
          />
          <QueryRows
            label="Phiên bản CSDL"
            query={schema}
            toChecks={() => [checkSchemaVersion(schema.data!, REQUIRED_SCHEMA_VERSION)]}
          />
          <QueryRows label="Dịch vụ lưu trữ" query={storage} toChecks={() => [storage.data!]} />
          <QueryRows label="Dịch vụ đăng nhập" query={auth} toChecks={() => checkAuthSettings(auth.data!)} />
        </dl>
      </Panel>

      {canViewHealth && (
        <Panel title="Chi tiết">
          <dl className="divide-y divide-border">
            <QueryRows label="Tình trạng CSDL" query={health} toChecks={() => checkHealth(health.data!)} />
          </dl>
        </Panel>
      )}
    </div>
  )
}
