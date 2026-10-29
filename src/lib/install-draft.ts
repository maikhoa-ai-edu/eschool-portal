/**
 * Bản nháp của trình cài đặt, lưu trong localStorage của trình duyệt người đang cài.
 *
 * Chỉ chứa thông tin kết nối công khai (URL + anon key) và bước đang làm, để:
 * - ứng dụng tạm dùng kết nối vừa nhập trong lúc config.json chưa được lưu lên hosting;
 * - mở lại trang (vd sau khi bấm liên kết xác nhận email) vẫn tiếp tục đúng bước.
 * Không phải nơi lưu dữ liệu của trường. config.json (hoặc biến môi trường) luôn được ưu tiên.
 */
import { z } from 'zod'
import { runtimeConfigSchema, type RuntimeConfig } from './runtime-config'

const STORAGE_KEY = 'eschool:install-draft'

const installDraftSchema = z.object({
  connection: runtimeConfigSchema.optional().catch(undefined),
  /** Đã qua bước 4: đã lưu config.json, hoặc chọn lưu sau (vẫn dùng tạm bản nháp) */
  configStepDone: z.boolean().optional().catch(undefined),
  step: z.number().int().min(1).max(9).optional().catch(undefined),
})

export type InstallDraft = z.infer<typeof installDraftSchema>

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readInstallDraft(store: Storage | null = storage()): InstallDraft {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = installDraftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function updateInstallDraft(
  patch: Partial<InstallDraft>,
  store: Storage | null = storage(),
): InstallDraft {
  const next = { ...readInstallDraft(store), ...patch }
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn cài được, chỉ là tải lại trang sẽ phải nhập lại
  }
  return next
}

export function clearInstallDraft(store: Storage | null = storage()): void {
  try {
    store?.removeItem(STORAGE_KEY)
  } catch {
    // bỏ qua
  }
}

export function readDraftConnection(store: Storage | null = storage()): RuntimeConfig | null {
  return readInstallDraft(store).connection ?? null
}
