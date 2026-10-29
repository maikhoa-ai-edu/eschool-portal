import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { loadRuntimeConfig } from '@/lib/runtime-config'
import { initSupabase } from '@/lib/supabase'
import './index.css'

const configState = await loadRuntimeConfig()
if (configState.status === 'configured') {
  initSupabase(configState.config)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App configState={configState} />
  </StrictMode>,
)
