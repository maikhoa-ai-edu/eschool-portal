import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { RuntimeConfig } from '@/lib/runtime-config'
import { configJsonText, detectHosting, downloadTextFile, isConfigLive, saveConfigViaPhp } from './api'
import { CopyValue, Steps } from './ui'

type Method = 'php' | 'vercel' | 'manual'

const METHOD_LABELS: Record<Method, string> = {
  php: 'cPanel (tự động)',
  vercel: 'Vercel',
  manual: 'Tải file lên (VibeHost, hosting khác)',
}

/**
 * Các cách lưu config.json tùy hosting. Gọi onSaved khi đã lưu (hoặc người cài xác nhận đã làm);
 * trong lúc chờ, trình duyệt này vẫn dùng tạm kết nối trong bản nháp.
 */
export function SaveConfigPanel({ config, onSaved }: { config: RuntimeConfig; onSaved: () => void }) {
  const hosting = useQuery({ queryKey: ['install', 'hosting'], queryFn: detectHosting })
  const [chosen, setChosen] = useState<Method | null>(null)

  if (hosting.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner /> Đang kiểm tra hosting...
      </div>
    )
  }

  const php = hosting.data?.php
  const phpUsable = Boolean(php && php.writable && !php.locked)
  const methods: Method[] = phpUsable ? ['php', 'vercel', 'manual'] : ['vercel', 'manual']
  const method = chosen ?? (phpUsable ? 'php' : hosting.data?.vercel ? 'vercel' : 'manual')

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Cách lưu cấu hình" className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={m === method}
            onClick={() => setChosen(m)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium',
              m === method
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text hover:bg-bg',
            )}
          >
            {METHOD_LABELS[m]}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="rounded-xl border border-border p-4">
        {method === 'php' && <PhpMethod config={config} onSaved={onSaved} />}
        {method === 'vercel' && <VercelMethod config={config} onSaved={onSaved} />}
        {method === 'manual' && <ManualMethod config={config} onSaved={onSaved} />}
      </div>
    </div>
  )
}

function PhpMethod({ config, onSaved }: { config: RuntimeConfig; onSaved: () => void }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const save = async () => {
    setState({ busy: true, error: null })
    try {
      await saveConfigViaPhp(config)
      if (!(await isConfigLive(config)))
        throw new Error('Đã ghi nhưng chưa đọc lại được config.json. Hãy thử tải lại trang.')
      onSaved()
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p>
        Hosting có PHP: bấm nút dưới đây để ghi <code>config.json</code> vào thư mục website. Sau khi ghi,{' '}
        <code>install.php</code> tự khóa (và tự xóa nếu hosting cho phép) để không ai ghi đè được nữa.
      </p>
      {state.error && (
        <Alert tone="danger" title={state.error}>
          Bạn có thể dùng cách “Tải file lên”.
        </Alert>
      )}
      <Button onClick={() => void save()} loading={state.busy}>
        Ghi config.json lên hosting
      </Button>
    </div>
  )
}

function VercelMethod({ config, onSaved }: { config: RuntimeConfig; onSaved: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <p>Vercel không cho website tự ghi file, nên cấu hình được đặt bằng biến môi trường:</p>
      <Steps>
        <li>
          Mở project trên <strong>vercel.com</strong> → <strong>Settings</strong> →{' '}
          <strong>Environment Variables</strong>.
        </li>
        <li>Thêm hai biến dưới đây (áp dụng cho Production), bấm Save.</li>
        <li>
          Vào <strong>Deployments</strong>, chọn bản mới nhất → <strong>Redeploy</strong>.
        </li>
      </Steps>
      <CopyValue label="VITE_SUPABASE_URL" value={config.supabaseUrl} />
      <CopyValue label="VITE_SUPABASE_ANON_KEY" value={config.supabaseAnonKey} />
      <p className="text-muted">
        Trong lúc Vercel build lại (1–2 phút), bạn cứ tiếp tục cài đặt: trình duyệt này tạm dùng kết nối vừa
        nhập.
      </p>
      <Button onClick={onSaved}>Đã thêm biến môi trường, tiếp tục</Button>
    </div>
  )
}

function ManualMethod({ config, onSaved }: { config: RuntimeConfig; onSaved: () => void }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const check = async () => {
    setState({ busy: true, error: null })
    if (await isConfigLive(config)) {
      onSaved()
      return
    }
    setState({
      busy: false,
      error:
        'Chưa thấy config.json đúng trên website. Kiểm tra file nằm cùng thư mục với index.html và tên là config.json.',
    })
  }

  return (
    <div className="space-y-3 text-sm">
      <Steps>
        <li>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTextFile('config.json', configJsonText(config), 'application/json')}
          >
            <Download className="h-4 w-4" aria-hidden /> Tải config.json
          </Button>
        </li>
        <li>
          Mở <strong>Trình quản lý file</strong> (File Manager) của hosting, vào thư mục chứa{' '}
          <code>index.html</code> của website và tải <code>config.json</code> lên đó.
        </li>
        <li>Bấm “Kiểm tra config.json”.</li>
      </Steps>
      <p className="text-muted">
        VibeHost: nếu triển khai từ GitHub có bước build (giống Vercel), có thể đặt hai biến môi trường{' '}
        <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> thay cho file này.
      </p>
      {state.error && <Alert tone="danger" title={state.error} />}
      <Button onClick={() => void check()} loading={state.busy}>
        Kiểm tra config.json
      </Button>
    </div>
  )
}
