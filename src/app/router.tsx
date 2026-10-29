import { createBrowserRouter, Navigate } from 'react-router'
import type { ConfigState } from '@/lib/runtime-config'
import { RouteError } from '@/components/RouteError'

export function createAppRouter(configState: ConfigState) {
  // Chưa có cấu hình kết nối: mọi đường dẫn đều dẫn về trình cài đặt
  if (configState.status === 'unconfigured') {
    return createBrowserRouter([
      {
        path: '/install',
        lazy: () => import('@/features/install/InstallPage').then((m) => ({ Component: m.InstallPage })),
        errorElement: <RouteError />,
      },
      { path: '*', element: <Navigate to="/install" replace /> },
    ])
  }

  return createBrowserRouter([
    {
      errorElement: <RouteError />,
      children: [
        {
          path: '/',
          lazy: () => import('@/features/system/StatusPage').then((m) => ({ Component: m.StatusPage })),
        },
        {
          path: '/install',
          lazy: () => import('@/features/install/InstallPage').then((m) => ({ Component: m.InstallPage })),
        },
        {
          path: '*',
          lazy: () => import('@/components/NotFound').then((m) => ({ Component: m.NotFound })),
        },
      ],
    },
  ])
}
