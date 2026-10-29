import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import type { ConfigState } from '@/lib/runtime-config'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { SiteProvider } from '@/features/site/SiteProvider'
import { ConfigStateContext } from './config-state'
import { createAppRouter } from './router'

/** Khi đã có cấu hình kết nối mới nạp thông tin trường và phiên đăng nhập. */
function ConnectedProviders({ configState, children }: { configState: ConfigState; children: ReactNode }) {
  if (configState.status !== 'configured') return <>{children}</>
  return (
    <SiteProvider>
      <AuthProvider>{children}</AuthProvider>
    </SiteProvider>
  )
}

export function App({ configState }: { configState: ConfigState }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 60_000 },
        },
      }),
  )
  const [router] = useState(() => createAppRouter(configState))

  return (
    <ConfigStateContext value={configState}>
      <QueryClientProvider client={queryClient}>
        <ConnectedProviders configState={configState}>
          <RouterProvider router={router} />
        </ConnectedProviders>
      </QueryClientProvider>
    </ConfigStateContext>
  )
}
