import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { readDraftConnection } from '@/lib/install-draft'
import { loadRuntimeConfig } from '@/lib/runtime-config'
import { initSupabase } from '@/lib/supabase'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import './index.css'

const configState = await loadRuntimeConfig(import.meta.env, fetch, readDraftConnection())
if (configState.status === 'configured') {
  initSupabase(configState.config)
}

// Chỉ bản build mới dùng service worker: khi phát triển, bộ nhớ đệm sẽ làm sai kết quả
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App configState={configState} />
  </StrictMode>,
)
