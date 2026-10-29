import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useConfigState } from '@/app/config-state'
import { useAuth } from '@/features/auth/auth-context'
import {
  clearInstallDraft,
  readInstallDraft,
  updateInstallDraft,
  type InstallDraft,
} from '@/lib/install-draft'
import type { ConfigSource, RuntimeConfig } from '@/lib/runtime-config'
import { fetchInstallStatus, INSTALL_STATUS_QUERY_KEY, probeSchema } from './api'
import { AdminStep } from './AdminStep'
import { DatabaseStep } from './DatabaseStep'
import { FinishStep, InstalledScreen } from './FinishStep'
import { PreConnectSteps } from './PreConnectSteps'
import { SaveConfigPanel } from './SaveConfigPanel'
import { BrandingStep, ModulesStep, SchoolInfoStep } from './SchoolSteps'
import { StepCard, WizardShell } from './ui'

/**
 * Trình cài đặt 9 bước. Bước hiện tại được suy ra từ trạng thái thật (CSDL, phiên đăng nhập,
 * nơi lưu cấu hình), nên tải lại trang hay mở từ máy khác đều tiếp tục đúng chỗ.
 */
export function InstallPage() {
  const configState = useConfigState()
  if (configState.status === 'unconfigured') return <PreConnectSteps />
  return <ConnectedWizard source={configState.source} config={configState.config} />
}

const FIRST_SETUP_STEP = 6
const LAST_STEP = 9

function ConnectedWizard({ source, config }: { source: ConfigSource; config: RuntimeConfig }) {
  const auth = useAuth()
  const [draft, setDraft] = useState<InstallDraft>(readInstallDraft)
  const patchDraft = (patch: Partial<InstallDraft>) => setDraft(updateInstallDraft(patch))
  const isDraft = source === 'install-draft'
  // Chỉ chờ phiên đăng nhập lần đầu; về sau (đăng ký, đăng nhập...) giữ nguyên bước đang hiện
  // để không mất trạng thái của form (vd thông báo sai mã cài đặt)
  const [authSettled, setAuthSettled] = useState(auth.status !== 'loading')
  if (!authSettled && auth.status !== 'loading') setAuthSettled(true)

  const schema = useQuery({ queryKey: ['install', 'schema'], queryFn: () => probeSchema(), staleTime: 0 })
  const ready = schema.data?.kind === 'ready'
  const status = useQuery({
    queryKey: INSTALL_STATUS_QUERY_KEY,
    queryFn: fetchInstallStatus,
    enabled: ready,
    staleTime: 0,
  })

  const changeConnection = isDraft
    ? () => {
        updateInstallDraft({ connection: undefined, configStepDone: false, step: 2 })
        window.location.assign('/install')
      }
    : undefined

  const completed = status.data?.kind === 'ok' && status.data.status.completed
  // Kết nối đã nằm trên hosting và cài xong: bản nháp (nếu còn) không cần nữa
  useEffect(() => {
    if (completed && !isDraft) clearInstallDraft()
  }, [completed, isDraft])

  if (schema.isPending || (ready && status.isPending) || !authSettled) {
    return <FullPageSpinner />
  }

  const probe = schema.data
  if (!probe || probe.kind === 'error' || status.isError) {
    return (
      <WizardShell current={3}>
        <StepCard title="Không kết nối được cơ sở dữ liệu">
          <Alert
            tone="danger"
            title={probe?.kind === 'error' ? probe.message : 'Không đọc được trạng thái cài đặt.'}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void schema.refetch()}>Thử lại</Button>
            {changeConnection && (
              <Button variant="outline" onClick={changeConnection}>
                Nhập lại thông tin kết nối
              </Button>
            )}
          </div>
        </StepCard>
      </WizardShell>
    )
  }

  if (probe.kind !== 'ready') {
    return (
      <WizardShell current={3}>
        <DatabaseStep
          config={config}
          probe={probe}
          checking={schema.isFetching}
          onRecheck={async () => (await schema.refetch()).data ?? probe}
          onChangeConnection={changeConnection}
        />
      </WizardShell>
    )
  }

  if (isDraft && !draft.configStepDone) {
    return (
      <WizardShell current={4}>
        <StepCard
          title="Lưu cấu hình kết nối"
          description={
            <>
              Website cần file <code>config.json</code> để mọi người truy cập đều kết nối được cơ sở dữ liệu.
              Chọn cách phù hợp với hosting của trường.
            </>
          }
          actions={
            <>
              {changeConnection ? (
                <Button variant="ghost" onClick={changeConnection}>
                  ← Đổi project Supabase
                </Button>
              ) : (
                <span />
              )}
              <Button variant="ghost" onClick={() => patchDraft({ configStepDone: true })}>
                Để sau, tiếp tục cài đặt →
              </Button>
            </>
          }
        >
          <SaveConfigPanel config={config} onSaved={() => patchDraft({ configStepDone: true })} />
        </StepCard>
      </WizardShell>
    )
  }

  // status.data chắc chắn có khi schema sẵn sàng (đã chờ ở trên)
  const installStatus =
    status.data?.kind === 'ok' ? status.data.status : { has_super_admin: false, completed: false }

  if (installStatus.completed) {
    return (
      <WizardShell current={LAST_STEP + 1}>
        <InstalledScreen source={source} config={config} />
      </WizardShell>
    )
  }

  if (auth.role !== 'SUPER_ADMIN') {
    return (
      <WizardShell current={5}>
        <AdminStep status={installStatus} config={config} />
      </WizardShell>
    )
  }

  const step = Math.min(Math.max(draft.step ?? FIRST_SETUP_STEP, FIRST_SETUP_STEP), LAST_STEP)
  const goTo = (next: number) => {
    patchDraft({ step: next })
    window.scrollTo({ top: 0 })
  }
  const back = () => goTo(step - 1)
  const next = () => goTo(step + 1)

  return (
    <WizardShell current={step}>
      {step === 6 && <SchoolInfoStep onNext={next} />}
      {step === 7 && <BrandingStep onBack={back} onNext={next} />}
      {step === 8 && <ModulesStep onBack={back} onNext={next} />}
      {step === 9 && <FinishStep source={source} config={config} onBack={back} />}
    </WizardShell>
  )
}
