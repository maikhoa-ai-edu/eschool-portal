import { useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useConfigState } from '@/app/config-state'
import { AdminPageHeader, Panel } from '@/components/admin/AdminPage'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { CheckboxField } from '@/components/ui/FormControls'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { formatDateTime, formatNumber } from '@/lib/format'
import { compareVersions } from '@/lib/semver'
import { REQUIRED_SCHEMA_VERSION } from '@/lib/version'
import { createBackup, openBackup, restoreBackup, type CreatedBackup, type OpenedBackup } from './api'

const CONFIRM_WORD = 'KHÔI PHỤC'

function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div role="status" className="space-y-1 text-sm">
      <p className="text-muted">
        {label} {formatNumber(done)}/{formatNumber(total)}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${total ? (done / total) * 100 : 100}%` }}
        />
      </div>
    </div>
  )
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Để trình duyệt kịp bắt đầu tải trước khi thu hồi địa chỉ tạm
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function ExportPanel({ sourceUrl }: { sourceUrl: string }) {
  const { identity } = useSite()
  const [includeFiles, setIncludeFiles] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [result, setResult] = useState<CreatedBackup | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const created = await createBackup(
        { includeFiles, schoolName: identity.school_name, sourceUrl },
        (done, total) => setProgress([done, total]),
      )
      saveBlob(created.blob, created.fileName)
      setResult(created)
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Panel title="Tạo bản sao lưu">
      <p className="text-sm text-muted">
        Gồm nội dung, cấu hình, danh sách tài khoản và nhật ký. <strong>Không gồm mật khẩu</strong>. File chứa
        email nhân sự và bản nháp nên hãy cất ở nơi an toàn, không chia sẻ công khai.
      </p>
      <CheckboxField
        label="Kèm ảnh và văn bản đã tải lên"
        hint="Nên bật. Bỏ chọn thì file nhẹ hơn nhưng không khôi phục được sang project mới."
        checked={includeFiles}
        onChange={(e) => setIncludeFiles(e.target.checked)}
      />
      {error && <Alert tone="danger" title={error} />}
      {progress && <ProgressBar label="Đang tải file" done={progress[0]} total={progress[1]} />}
      {result &&
        (result.missing.length > 0 ? (
          <Alert tone="warning" title={`Đã tải ${result.fileName} nhưng thiếu ${result.missing.length} file`}>
            Không đọc được: {result.missing.join(', ')}
          </Alert>
        ) : (
          <Alert tone="success" title={`Đã tải ${result.fileName}`}>
            Kèm {formatNumber(result.fileCount)} file, {(result.blob.size / 1024 / 1024).toFixed(1)} MB.
          </Alert>
        ))}
      <Button onClick={() => void run()} loading={busy}>
        <Download className="h-4 w-4" aria-hidden /> Tải bản sao lưu
      </Button>
    </Panel>
  )
}

function RestorePanel({ targetUrl }: { targetUrl: string }) {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState<OpenedBackup | null>(null)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setOpened(null)
    setDone(false)
    setWord('')
    setError(null)
    if (!file) return
    try {
      setOpened(await openBackup(file))
    } catch (err) {
      setError(toVietnameseError(err))
    }
  }

  const run = async () => {
    if (!opened) return
    setBusy(true)
    setError(null)
    try {
      await restoreBackup(opened, targetUrl, (d, t) => setProgress([d, t]))
      setDone(true)
      setOpened(null)
      setWord('')
      await queryClient.invalidateQueries()
    } catch (err) {
      setError(toVietnameseError(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const manifest = opened?.manifest
  const tooNew = manifest ? compareVersions(manifest.schema_version, REQUIRED_SCHEMA_VERSION) > 0 : false
  const count = (table: string) => formatNumber(manifest?.data[table]?.length ?? 0)

  return (
    <Panel title="Khôi phục từ bản sao lưu">
      <Alert tone="warning" title="Toàn bộ nội dung hiện tại sẽ bị thay thế">
        Nên tải một bản sao lưu của website này trước. Tài khoản mới tạo lại khi khôi phục chưa có mật khẩu:
        mỗi người bấm “Quên mật khẩu?” ở trang đăng nhập để đặt mật khẩu. Lời mời còn mở được cấp liên kết
        mới.
      </Alert>
      {done && (
        <Alert tone="success" title="Đã khôi phục xong">
          Mở trang công khai để kiểm tra lại.
        </Alert>
      )}
      {error && <Alert tone="danger" title={error} />}
      <div className="space-y-1.5">
        <label htmlFor="backup-file" className="block text-sm font-medium">
          Chọn file sao lưu (.zip)
        </label>
        <input
          id="backup-file"
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => void onFile(e)}
          className="block w-full text-sm"
        />
      </div>

      {manifest && (
        <div className="space-y-3">
          <dl className="grid gap-x-4 gap-y-1 rounded-lg border border-border bg-bg p-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Trường</dt>
            <dd className="font-medium">{manifest.school_name}</dd>
            <dt className="text-muted">Thời điểm sao lưu</dt>
            <dd className="font-medium">{formatDateTime(manifest.created_at)}</dd>
            <dt className="text-muted">Phiên bản CSDL</dt>
            <dd className="font-medium">{manifest.schema_version}</dd>
            <dt className="text-muted">Nội dung</dt>
            <dd className="font-medium">
              {count('news')} tin, {count('announcements')} thông báo, {count('documents')} văn bản,{' '}
              {count('albums')} album, {count('profiles')} tài khoản
            </dd>
            <dt className="text-muted">File kèm theo</dt>
            <dd className="font-medium">{formatNumber(manifest.files.length)}</dd>
          </dl>
          {manifest.files.length === 0 && (
            <Alert tone="warning" title="Bản sao lưu này không kèm file">
              Ảnh và văn bản chỉ hiển thị được nếu file vẫn còn trên project này.
            </Alert>
          )}
          {manifest.missing_files.length > 0 && (
            <Alert tone="warning" title={`Bản sao lưu thiếu ${manifest.missing_files.length} file`}>
              {manifest.missing_files.join(', ')}
            </Alert>
          )}
          {tooNew ? (
            <Alert tone="danger" title="Bản sao lưu mới hơn website này">
              Hãy cập nhật website và CSDL lên phiên bản mới nhất rồi khôi phục lại.
            </Alert>
          ) : (
            <>
              <Field
                label={`Gõ ${CONFIRM_WORD} để xác nhận`}
                value={word}
                autoComplete="off"
                onChange={(e) => setWord(e.target.value)}
              />
              {progress && <ProgressBar label="Đang tải file lên" done={progress[0]} total={progress[1]} />}
              <Button
                variant="danger"
                disabled={word !== CONFIRM_WORD}
                loading={busy}
                onClick={() => void run()}
              >
                <Upload className="h-4 w-4" aria-hidden /> Khôi phục
              </Button>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

export function BackupPage() {
  const configState = useConfigState()
  const url = configState.status === 'configured' ? configState.config.supabaseUrl : ''
  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Sao lưu & khôi phục"
        description="Tải dữ liệu của trường về máy, hoặc chuyển sang một project Supabase mới."
      />
      <ExportPanel sourceUrl={url} />
      <RestorePanel targetUrl={url} />
    </div>
  )
}
