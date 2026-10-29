import { createContext, use } from 'react'
import type { ModuleKey, SiteSettings } from './settings'

export interface SiteContextValue extends SiteSettings {
  isModuleEnabled: (key: ModuleKey) => boolean
}

export const SiteContext = createContext<SiteContextValue | null>(null)

export function useSite(): SiteContextValue {
  const value = use(SiteContext)
  if (!value) throw new Error('useSite phải nằm trong <SiteProvider>')
  return value
}
