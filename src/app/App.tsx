import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import type { ConfigState } from '@/lib/runtime-config'
import { ConfigStateContext } from './config-state'
import { createAppRouter } from './router'

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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigStateContext>
  )
}
