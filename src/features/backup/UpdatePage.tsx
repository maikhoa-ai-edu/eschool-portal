import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { useConfigState } from '@/app/config-state'
import { AdminPageHeader, Panel, QueryState } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-classes'
import { dashboardLink } from '@/features/install/api'
import { getSupabase } from '@/lib/supabase'
import { compareVersions } from '@/lib/semver'
import { APP_VERSION, REQUIRED_SCHEMA_VERSION } from '@/lib/version'

const RELEASES_API = 'https://api.github.com/repos/maikhoa-ai-edu/eschool-portal/releases/latest'

interface LatestRelease {
  version: string
  url: string
  notes: string
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
  // Chưa có bản phát hành nào
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Không kiểm tra được bản mới trên GitHub. Vui lòng thử lại sau.')
  const data = (await res.json()) as { tag_name: string; html_url: string; body?: string | null }
  return { version: data.tag_name.replace(/^v/, ''), url: data.html_url, notes: data.body ?? '' }
}

interface UpgradeStep {
  version: string
  from: string
  file: string
}

async function fetchSchemaVersion(): Promise<string> {
  const { data, error } = await getSupabase().rpc('get_schema_version')
  if (error) throw error
  return String(data)
}

/** Ghép các bước nâng cấp còn thiếu, từ phiên bản CSDL hiện tại tới phiên bản website cần. */
async function fetchUpgradeSql(current: string): Promise<string> {
  const res = await fetch('/upgrades/index.json')
  if (!res.ok) throw new Error('Không đọc được danh sách file nâng cấp.')
  const steps = (await res.json()) as UpgradeStep[]
  const pending = steps
    .filter((s) => compareVersions(s.version, current) > 0)
    .sort((a, b) => compareVersions(a.version, b.version))
  const parts = await Promise.all(
    pending.map(async (step) => {
      const file = await fetch(`/upgrades/${step.file}`)
      if (!file.ok) throw new Error(`Không đọc được ${step.file}.`)
      return file.text()
    }),
  )
  return parts.join('\n\n')
}

function SchemaUpgrade({ current }: { current: string }) {
  const queryClient = useQueryClient()
  const configState = useConfigState()
  const [copied, setCopied] = useState(false)
  const sql = useQuery({ queryKey: ['upgrade-sql', current], queryFn: () => fetchUpgradeSql(current) })
  const url = configState.status === 'configured' ? configState.config.supabaseUrl : ''

  return (
    <div className="space-y-3">
      <Alert tone="warning" title={`CSDL đang ở ${current}, bản website này cần ${REQUIRED_SCHEMA_VERSION}`}>
        Làm theo thứ tự: tải bản sao lưu ở mục Sao lưu, sao chép đoạn SQL dưới đây, dán vào SQL Editor của
        Supabase rồi bấm Run. Nếu có lỗi, CSDL giữ nguyên trạng thái cũ.
      </Alert>
      <QueryState isPending={sql.isPending} error={sql.error} />
      {sql.data && (
        <>
          <textarea
            readOnly
            aria-label="SQL nâng cấp"
            rows={8}
            value={sql.data}
            className="w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(sql.data).then(() => setCopied(true))
              }}
            >
              <Copy className="h-4 w-4" aria-hidden /> {copied ? 'Đã sao chép' : 'Sao chép SQL'}
            </Button>
            <a
              href={dashboardLink(url, 'sql/new')}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses('outline')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Mở SQL Editor
            </a>
            <Button onClick={() => void queryClient.invalidateQueries({ queryKey: ['schema-version'] })}>
              Tôi đã chạy xong, kiểm tra lại
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function UpdatePage() {
  const schema = useQuery({ queryKey: ['schema-version'], queryFn: fetchSchemaVersion })
  const release = useQuery({ queryKey: ['latest-release'], queryFn: fetchLatestRelease, retry: false })
  const hasNewRelease = release.data ? compareVersions(release.data.version, APP_VERSION) > 0 : false

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Cập nhật"
        description="Kiểm tra bản mới của website và nâng cấp cơ sở dữ liệu."
      />

      <Panel title="Phiên bản website">
        <p className="text-sm">
          Đang dùng <strong>{APP_VERSION}</strong>
        </p>
        <QueryState isPending={release.isPending} error={release.error} />
        {release.isSuccess && !release.data && (
          <p className="text-sm text-muted">Chưa có bản phát hành nào.</p>
        )}
        {release.data && !hasNewRelease && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Đang dùng bản mới nhất (
            {release.data.version}).
          </p>
        )}
        {release.data && hasNewRelease && (
          <Alert tone="info" title={`Có bản mới: ${release.data.version}`}>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Tải bản sao lưu ở mục Sao lưu.</li>
              <li>
                Vercel: cập nhật repo rồi Redeploy. cPanel, VibeHost: tải <code>dist.zip</code>, giải nén đè
                lên thư mục web (giữ nguyên <code>config.json</code>).
              </li>
              <li>Mở lại trang này: nếu CSDL cần nâng cấp, đoạn SQL sẽ hiện ở mục dưới.</li>
            </ol>
            <a
              href={release.data.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-primary underline"
            >
              Xem bản phát hành
            </a>
          </Alert>
        )}
      </Panel>

      <Panel title="Cơ sở dữ liệu">
        <QueryState isPending={schema.isPending} error={schema.error} />
        {schema.data && compareVersions(schema.data, REQUIRED_SCHEMA_VERSION) === 0 && (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> CSDL đúng phiên bản ({schema.data}),
            không cần nâng cấp.
          </p>
        )}
        {schema.data && compareVersions(schema.data, REQUIRED_SCHEMA_VERSION) < 0 && (
          <SchemaUpgrade current={schema.data} />
        )}
        {schema.data && compareVersions(schema.data, REQUIRED_SCHEMA_VERSION) > 0 && (
          <Alert
            tone="warning"
            title={`CSDL (${schema.data}) mới hơn bản website này (${REQUIRED_SCHEMA_VERSION})`}
          >
            Hãy cập nhật website lên bản mới nhất.
          </Alert>
        )}
      </Panel>
    </div>
  )
}
