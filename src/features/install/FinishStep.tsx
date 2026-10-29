import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PartyPopper } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-classes'
import { useAuth } from '@/features/auth/auth-context'
import { useSite } from '@/features/site/site-context'
import { toVietnameseError } from '@/lib/errors'
import { clearInstallDraft } from '@/lib/install-draft'
import type { ConfigSource, RuntimeConfig } from '@/lib/runtime-config'
import { getSupabase } from '@/lib/supabase'
import { fetchInstallStatus, INSTALL_STATUS_QUERY_KEY, isConfigLive } from './api'
import { SaveConfigPanel } from './SaveConfigPanel'
import { MODULE_INFO } from './steps'
import { StepCard } from './ui'

/** Kết nối đang dùng đã nằm trên hosting chưa (config.json/biến môi trường), hay mới chỉ ở bản nháp. */
function useConfigLive(source: ConfigSource, config: RuntimeConfig) {
  return useQuery({
    queryKey: ['install', 'config-live', config.supabaseUrl],
    queryFn: () => isConfigLive(config),
    enabled: source === 'install-draft',
    initialData: source === 'install-draft' ? undefined : true,
  })
}

function ConfigNotLiveWarning({ config, onSaved }: { config: RuntimeConfig; onSaved: () => void }) {
  return (
    <div className="space-y-3">
      <Alert tone="warning" title="Website chưa lưu cấu hình kết nối">
        Hiện chỉ trình duyệt này kết nối được cơ sở dữ liệu. Người khác vào website sẽ thấy trang cài đặt cho
        tới khi config.json (hoặc biến môi trường trên Vercel) được lưu. Đã đặt biến môi trường trên Vercel
        thì đợi deploy xong rồi tải lại trang.
      </Alert>
      <SaveConfigPanel config={config} onSaved={onSaved} />
    </div>
  )
}

export function FinishStep({
  source,
  config,
  onBack,
}: {
  source: ConfigSource
  config: RuntimeConfig
  onBack: () => void
}) {
  const site = useSite()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const live = useConfigLive(source, config)
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const finish = async () => {
    setState({ busy: true, error: null })
    try {
      const { error } = await getSupabase().rpc('complete_install')
      if (error) throw error
      // Đã lưu cấu hình lên hosting thì bản nháp hết tác dụng; chưa lưu thì giữ để trình duyệt này còn chạy được
      if (live.data) clearInstallDraft()
      // Cập nhật ngay trạng thái để cổng chặn không đưa ngược về /install
      await queryClient.fetchQuery({
        queryKey: INSTALL_STATUS_QUERY_KEY,
        queryFn: fetchInstallStatus,
        staleTime: 0,
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      setState({ busy: false, error: toVietnameseError(err) })
    }
  }

  const enabledModules = Object.entries(site.modules)
    .filter(([, on]) => on)
    .map(([key]) => MODULE_INFO[key]?.label ?? key)

  return (
    <StepCard
      title="Hoàn tất cài đặt"
      description="Kiểm tra lại thông tin dưới đây. Mọi mục đều sửa được sau trong trang quản trị."
      actions={
        <>
          <Button variant="ghost" onClick={onBack}>
            ← Quay lại
          </Button>
          <Button onClick={() => void finish()} loading={state.busy}>
            Hoàn tất và vào trang quản trị
          </Button>
        </>
      }
    >
      {state.error && <Alert tone="danger" title={state.error} />}
      <dl className="divide-y divide-border rounded-xl border border-border text-sm">
        <SummaryRow label="Tên trường" value={site.identity.school_name} />
        <SummaryRow label="Cơ quan chủ quản" value={site.identity.governing_body || '—'} />
        <SummaryRow label="Khẩu hiệu" value={site.identity.slogan || '—'} />
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-muted">Màu sắc</dt>
          <dd className="flex gap-2">
            <span
              className="h-6 w-6 rounded-full border border-border"
              style={{ background: site.branding.primary_color }}
              title={site.branding.primary_color}
            />
            <span
              className="h-6 w-6 rounded-full border border-border"
              style={{ background: site.branding.accent_color }}
              title={site.branding.accent_color}
            />
          </dd>
        </div>
        <SummaryRow
          label="Logo"
          value={site.branding.logo_url ? 'Đã tải lên' : 'Chưa có (dùng chữ viết tắt)'}
        />
        <SummaryRow label="Module" value={enabledModules.join(', ') || 'Không bật module nào'} />
        <SummaryRow label="Quản trị viên cấp cao" value={profile?.email ?? '—'} />
      </dl>

      {live.data === false && <ConfigNotLiveWarning config={config} onSaved={() => void live.refetch()} />}
    </StepCard>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

/** CSDL đã đánh dấu cài đặt xong: không cho chạy lại các bước. */
export function InstalledScreen({ source, config }: { source: ConfigSource; config: RuntimeConfig }) {
  const live = useConfigLive(source, config)
  const { role } = useAuth()

  return (
    <StepCard
      title="Website đã được cài đặt"
      description="Cơ sở dữ liệu này đã hoàn tất cài đặt. Mọi thay đổi tiếp theo thực hiện trong trang quản trị."
    >
      <PartyPopper className="h-10 w-10 text-accent" aria-hidden />
      {live.data === false && role === 'SUPER_ADMIN' && (
        <ConfigNotLiveWarning
          config={config}
          onSaved={() => {
            clearInstallDraft()
            void live.refetch()
          }}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Link to="/" className={buttonClasses('outline')}>
          Xem trang chủ
        </Link>
        <Link to="/admin" className={buttonClasses('primary')}>
          Vào trang quản trị
        </Link>
      </div>
    </StepCard>
  )
}
