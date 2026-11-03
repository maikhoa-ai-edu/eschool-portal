/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** Tên dịch vụ hosting đã build website, rỗng khi không rõ */
declare const __HOSTING__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
