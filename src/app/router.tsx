import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import type { ConfigState } from '@/lib/runtime-config'
import { RouteError } from '@/components/RouteError'
import { ComingSoon } from '@/components/ComingSoon'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { RequirePermission, RequireStaff } from '@/features/auth/guards'
import { ModuleGate } from '@/features/site/ModuleGate'
import { ADMIN_PLACEHOLDER_ROUTES } from '@/layouts/admin/admin-nav'

const installRoute: RouteObject = {
  path: '/install',
  lazy: () => import('@/features/install/InstallPage').then((m) => ({ Component: m.InstallPage })),
}

// Trang công khai của các module (hoàn thiện ở Giai đoạn 4)
const publicModuleRoutes: RouteObject[] = [
  {
    path: 'tin-tuc/*',
    element: (
      <ModuleGate module="news">
        <ComingSoon title="Tin tức" phase={4} />
      </ModuleGate>
    ),
  },
  {
    path: 'thong-bao/*',
    element: (
      <ModuleGate module="announcements">
        <ComingSoon title="Thông báo" phase={4} />
      </ModuleGate>
    ),
  },
  {
    path: 'van-ban/*',
    element: (
      <ModuleGate module="documents">
        <ComingSoon title="Văn bản" phase={4} />
      </ModuleGate>
    ),
  },
  {
    path: 'thu-vien-anh/*',
    element: (
      <ModuleGate module="albums">
        <ComingSoon title="Thư viện ảnh" phase={4} />
      </ModuleGate>
    ),
  },
  {
    path: 'trang/:slug',
    element: (
      <ModuleGate module="pages">
        <ComingSoon title="Trang thông tin" phase={4} />
      </ModuleGate>
    ),
  },
]

export function createAppRouter(configState: ConfigState) {
  // Chưa có cấu hình kết nối: mọi đường dẫn đều dẫn về trình cài đặt
  if (configState.status === 'unconfigured') {
    return createBrowserRouter([
      { ...installRoute, errorElement: <RouteError /> },
      { path: '*', element: <Navigate to="/install" replace /> },
    ])
  }

  return createBrowserRouter([
    {
      errorElement: <RouteError />,
      // Hiện trong lúc tải mã của trang đầu tiên (route lazy)
      hydrateFallbackElement: <FullPageSpinner />,
      children: [
        installRoute,
        {
          path: '/dang-nhap',
          lazy: () => import('@/features/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
        },
        {
          path: '/',
          lazy: () => import('@/layouts/public/PublicLayout').then((m) => ({ Component: m.PublicLayout })),
          children: [
            {
              index: true,
              lazy: () => import('@/features/home/HomePage').then((m) => ({ Component: m.HomePage })),
            },
            ...publicModuleRoutes,
            {
              path: '*',
              lazy: () => import('@/components/NotFound').then((m) => ({ Component: m.NotFound })),
            },
          ],
        },
        {
          path: '/admin',
          element: <RequireStaff />,
          children: [
            {
              lazy: () => import('@/layouts/admin/AdminLayout').then((m) => ({ Component: m.AdminLayout })),
              children: [
                {
                  index: true,
                  lazy: () =>
                    import('@/features/admin/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
                },
                {
                  path: 'he-thong',
                  lazy: () =>
                    import('@/features/system/StatusPage').then((m) => ({ Component: m.StatusPage })),
                },
                // Các chức năng quản trị khác: giữ chỗ, đã chặn theo quyền
                ...ADMIN_PLACEHOLDER_ROUTES.map((item) => ({
                  path: item.to.replace('/admin/', '') + '/*',
                  element: item.permission ? (
                    <RequirePermission permission={item.permission}>
                      <ComingSoon title={item.label} phase={item.phase ?? 4} />
                    </RequirePermission>
                  ) : (
                    <ComingSoon title={item.label} phase={item.phase ?? 4} />
                  ),
                })),
                {
                  path: '*',
                  lazy: () => import('@/components/NotFound').then((m) => ({ Component: m.NotFound })),
                },
              ],
            },
          ],
        },
      ],
    },
  ])
}
