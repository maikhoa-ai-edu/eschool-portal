import { useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { fetchSiteSettings, parseSiteSettings, SITE_SETTINGS_QUERY_KEY, type ModuleKey } from './settings'
import { SiteContext, type SiteContextValue } from './site-context'
import { applyBranding, applyDocumentIdentity } from './theme'

export function SiteProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: SITE_SETTINGS_QUERY_KEY, queryFn: fetchSiteSettings })

  const value = useMemo<SiteContextValue | null>(() => {
    if (query.isPending) return null
    // Lỗi mạng/CSDL: vẫn hiển thị với giá trị mặc định thay vì trắng trang
    const settings = query.data ?? parseSiteSettings([], [])
    return {
      ...settings,
      isModuleEnabled: (key: ModuleKey) => settings.modules[key] ?? true,
    }
  }, [query.isPending, query.data])

  useEffect(() => {
    if (!value) return
    applyBranding(value.branding)
    applyDocumentIdentity(value.identity, value.branding)
  }, [value])

  if (!value) return <FullPageSpinner />
  return <SiteContext value={value}>{children}</SiteContext>
}
