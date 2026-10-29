import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { RuntimeConfig } from '@/lib/runtime-config'
import { REQUIRED_SCHEMA_VERSION } from '@/lib/version'
import { dashboardLink, downloadTextFile, type SchemaProbe } from './api'
import { CopyButton, StepCard, Steps } from './ui'

async function fetchInstallSql(): Promise<string> {
  const res = await fetch('/install.sql', { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok || !text.includes('eSchool Portal: install.sql')) {
    throw new Error(
      'Không tải được install.sql từ website. Hãy kiểm tra file install.sql đã được tải lên hosting.',
    )
  }
  return text
}

export function DatabaseStep({
  config,
  probe,
  checking,
  onRecheck,
  onChangeConnection,
}: {
  config: RuntimeConfig
  probe: SchemaProbe
  checking: boolean
  onRecheck: () => Promise<SchemaProbe>
  onChangeConnection?: () => void
}) {
  const sql = useQuery({ queryKey: ['install', 'sql'], queryFn: fetchInstallSql, staleTime: Infinity })
  const [rechecked, setRechecked] = useState(false)

  const recheck = async () => {
    await onRecheck()
    setRechecked(true)
  }

  return (
    <StepCard
      title="Khởi tạo cơ sở dữ liệu"
      description="Tạo bảng, phân quyền và kho lưu trữ ảnh cho website bằng cách chạy file install.sql trong Supabase."
      actions={
        <>
          {onChangeConnection ? (
            <Button variant="ghost" onClick={onChangeConnection}>
              ← Đổi project Supabase
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void recheck()} loading={checking}>
            Tôi đã chạy xong, kiểm tra
          </Button>
        </>
      }
    >
      {probe.kind === 'outdated' && (
        <Alert
          tone="danger"
          title={`CSDL đang ở phiên bản ${probe.version || 'không rõ'}, cần ${REQUIRED_SCHEMA_VERSION}`}
        >
          Project này đã có dữ liệu của bản khác. Hãy dùng một project Supabase mới, hoặc chạy file nâng cấp
          tương ứng.
        </Alert>
      )}
      {probe.kind === 'empty' && rechecked && !checking && (
        <Alert tone="warning" title="Chưa thấy cơ sở dữ liệu">
          Hãy xem lại kết quả trong SQL Editor: nếu có dòng báo lỗi màu đỏ, chụp màn hình lỗi đó để được hỗ
          trợ.
        </Alert>
      )}

      <Steps>
        <li>
          Mở{' '}
          <a
            href={dashboardLink(config.supabaseUrl, 'sql/new')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary underline"
          >
            SQL Editor của project <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          .
        </li>
        <li>
          Bấm “Sao chép install.sql” bên dưới, dán toàn bộ vào ô soạn thảo rồi bấm <strong>Run</strong>.
        </li>
        <li>
          Đợi chạy xong (vài giây). Kết quả cuối cùng là một ô <strong>Mã cài đặt</strong> gồm 12 ký tự:{' '}
          <strong>ghi lại mã này</strong>, sẽ dùng ở bước tạo quản trị viên.
        </li>
        <li>Quay lại đây và bấm “Tôi đã chạy xong, kiểm tra”.</li>
      </Steps>

      {sql.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Đang tải install.sql...
        </div>
      )}
      {sql.isError && <Alert tone="danger" title={sql.error.message} />}
      {sql.isSuccess && (
        <div className="rounded-xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg px-3 py-2">
            <p className="text-sm font-semibold">install.sql</p>
            <div className="flex gap-2">
              <CopyButton text={sql.data} label="Sao chép install.sql" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTextFile('install.sql', sql.data, 'application/sql')}
              >
                <Download className="h-4 w-4" aria-hidden /> Tải về
              </Button>
            </div>
          </div>
          <textarea
            readOnly
            aria-label="Nội dung install.sql"
            value={sql.data}
            spellCheck={false}
            className="block h-48 w-full resize-y rounded-b-xl bg-surface p-3 font-mono text-xs text-text focus:outline-none"
          />
        </div>
      )}
    </StepCard>
  )
}
