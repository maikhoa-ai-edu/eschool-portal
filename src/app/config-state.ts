import { createContext, use } from 'react'
import type { ConfigState } from '@/lib/runtime-config'

export const ConfigStateContext = createContext<ConfigState | null>(null)

export function useConfigState(): ConfigState {
  const state = use(ConfigStateContext)
  if (!state) throw new Error('useConfigState phải nằm trong <App>')
  return state
}
