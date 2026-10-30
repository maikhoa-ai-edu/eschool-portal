import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import type { ConfigState } from '@/lib/runtime-config'
import { RouteError } from '@/components/RouteError'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { RequirePermission, RequireStaff } from '@/features/auth/guards'
import { InstallGate } from '@/features/install/InstallGate'
import { ModuleGate } from '@/features/site/ModuleGate'
import type { ModuleKey } from '@/features/site/settings'

const installRoute: RouteObject = {
  path: '/install',
  lazy: () => import('@/features/install/InstallPage').then((m) => ({ Component: m.InstallPage })),
}

/** Route tải mã khi cần: page(() => import('...'), 'TênComponent') */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return () => load().then((m) => ({ Component: m[name] as ComponentType }))
}

/** Nhóm route công khai của một module (tắt module thì hiện thông báo tạm ngừng). */
function publicModule(path: string, module: ModuleKey, children: RouteObject[]): RouteObject {
  return {
    path,
    element: (
      <ModuleGate module={module}>
        <Outlet />
      </ModuleGate>
    ),
    children,
  }
}

const publicModuleRoutes: RouteObject[] = [
  publicModule('tin-tuc', 'news', [
    { index: true, lazy: page(() => import('@/features/news/public/NewsListPage'), 'NewsListPage') },
    {
      path: 'chuyen-muc/:slug',
      lazy: page(() => import('@/features/news/public/NewsListPage'), 'CategoryNewsPage'),
    },
    { path: 'the/:slug', lazy: page(() => import('@/features/news/public/NewsListPage'), 'TagNewsPage') },
    { path: ':slug', lazy: page(() => import('@/features/news/public/NewsDetailPage'), 'NewsDetailPage') },
  ]),
  publicModule('thong-bao', 'announcements', [
    {
      index: true,
      lazy: page(() => import('@/features/announcements/public/AnnouncementPages'), 'AnnouncementListPage'),
    },
    {
      path: ':id',
      lazy: page(() => import('@/features/announcements/public/AnnouncementPages'), 'AnnouncementDetailPage'),
    },
  ]),
  publicModule('van-ban', 'documents', [
    {
      index: true,
      lazy: page(() => import('@/features/documents/public/DocumentPages'), 'DocumentListPage'),
    },
    {
      path: ':id',
      lazy: page(() => import('@/features/documents/public/DocumentPages'), 'DocumentDetailPage'),
    },
  ]),
  publicModule('thu-vien-anh', 'albums', [
    { index: true, lazy: page(() => import('@/features/albums/public/AlbumPages'), 'AlbumListPage') },
    { path: ':slug', lazy: page(() => import('@/features/albums/public/AlbumPages'), 'AlbumDetailPage') },
  ]),
  publicModule('trang', 'pages', [
    { index: true, element: <Navigate to="/" replace /> },
    { path: ':slug', lazy: page(() => import('@/features/pages/public/StaticPage'), 'StaticPage') },
  ]),
  publicModule('chuyen-de', 'topics', [
    { index: true, lazy: page(() => import('@/features/topics/public/TopicPages'), 'TopicIndexPage') },
    { path: ':slug', lazy: page(() => import('@/features/topics/public/TopicPages'), 'TopicPage') },
  ]),
]

/** Nhóm route quản trị cần một quyền (CSDL vẫn kiểm tra lại bằng RLS). */
function adminSection(path: string, permission: string, children: RouteObject[]): RouteObject {
  return {
    path,
    element: (
      <RequirePermission permission={permission}>
        <Outlet />
      </RequirePermission>
    ),
    children,
  }
}

/** Danh sách + tạo mới (moi) + sửa (:id) dùng chung một trang soạn. */
function listAndEditor(list: RouteObject['lazy'], editor: RouteObject['lazy']): RouteObject[] {
  return [
    { index: true, lazy: list },
    { path: 'moi', lazy: editor },
    { path: ':id', lazy: editor },
  ]
}

const adminContentRoutes: RouteObject[] = [
  adminSection(
    'tin-tuc',
    'news.create',
    listAndEditor(
      page(() => import('@/features/news/admin/NewsListPage'), 'NewsListPage'),
      page(() => import('@/features/news/admin/NewsEditorPage'), 'NewsEditorPage'),
    ),
  ),
  adminSection('chuyen-muc', 'news.manage_taxonomy', [
    { index: true, lazy: page(() => import('@/features/news/admin/TaxonomyPage'), 'TaxonomyPage') },
  ]),
  adminSection(
    'thong-bao',
    'announcements.manage',
    listAndEditor(
      page(() => import('@/features/announcements/admin/AnnouncementListPage'), 'AnnouncementListPage'),
      page(() => import('@/features/announcements/admin/AnnouncementEditorPage'), 'AnnouncementEditorPage'),
    ),
  ),
  adminSection(
    'van-ban',
    'documents.manage',
    listAndEditor(
      page(() => import('@/features/documents/admin/DocumentListPage'), 'DocumentListPage'),
      page(() => import('@/features/documents/admin/DocumentEditorPage'), 'DocumentEditorPage'),
    ),
  ),
  adminSection(
    'thu-vien-anh',
    'media.manage',
    listAndEditor(
      page(() => import('@/features/albums/admin/AlbumListPage'), 'AlbumListPage'),
      page(() => import('@/features/albums/admin/AlbumEditorPage'), 'AlbumEditorPage'),
    ),
  ),
  adminSection(
    'trang',
    'pages.manage',
    listAndEditor(
      page(() => import('@/features/pages/admin/PageListPage'), 'PageListPage'),
      page(() => import('@/features/pages/admin/PageEditorPage'), 'PageEditorPage'),
    ),
  ),
  adminSection(
    'chuyen-de',
    'topics.manage',
    listAndEditor(
      page(() => import('@/features/topics/admin/TopicListPage'), 'TopicListPage'),
      page(() => import('@/features/topics/admin/TopicEditorPage'), 'TopicEditorPage'),
    ),
  ),
  adminSection('trang-chu', 'homepage.manage', [
    {
      index: true,
      lazy: page(() => import('@/features/homepage/admin/HomepageAdminPage'), 'HomepageAdminPage'),
    },
  ]),
  adminSection('cai-dat', 'settings.manage', [
    { index: true, lazy: page(() => import('@/features/settings/SettingsPages'), 'SchoolInfoPage') },
  ]),
  adminSection('nhan-dien', 'settings.manage', [
    { index: true, lazy: page(() => import('@/features/settings/SettingsPages'), 'BrandingPage') },
  ]),
  adminSection('module', 'modules.manage', [
    { index: true, lazy: page(() => import('@/features/settings/SettingsPages'), 'ModulesPage') },
  ]),
  adminSection('menu', 'menus.manage', [
    { index: true, lazy: page(() => import('@/features/menus/MenuPage'), 'MenuPage') },
  ]),
  adminSection('tai-khoan', 'users.manage', [
    { index: true, lazy: page(() => import('@/features/accounts/AccountsPage'), 'AccountsPage') },
  ]),
  adminSection('sao-luu', 'backup.manage', [
    { index: true, lazy: page(() => import('@/features/backup/BackupPage'), 'BackupPage') },
  ]),
  adminSection('cap-nhat', 'backup.manage', [
    { index: true, lazy: page(() => import('@/features/backup/UpdatePage'), 'UpdatePage') },
  ]),
  adminSection('nhat-ky', 'audit.view', [
    { index: true, lazy: page(() => import('@/features/audit/AuditLogPage'), 'AuditLogPage') },
  ]),
]

export function createAppRouter(configState: ConfigState) {
  // Chưa có cấu hình kết nối: mọi đường dẫn đều dẫn về trình cài đặt
  if (configState.status === 'unconfigured') {
    return createBrowserRouter([
      { ...installRoute, errorElement: <RouteError />, hydrateFallbackElement: <FullPageSpinner /> },
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
          // CSDL chưa cài xong thì mọi trang (trừ /install) dẫn về trình cài đặt
          element: <InstallGate />,
          children: [
            {
              path: '/dang-nhap',
              lazy: () => import('@/features/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
            },
            {
              path: '/quen-mat-khau',
              lazy: page(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage'),
            },
            {
              path: '/dat-lai-mat-khau',
              lazy: page(() => import('@/features/auth/ResetPasswordPage'), 'ResetPasswordPage'),
            },
            {
              path: '/dang-ky',
              lazy: () => import('@/features/auth/RegisterPage').then((m) => ({ Component: m.RegisterPage })),
            },
            {
              path: '/',
              lazy: () =>
                import('@/layouts/public/PublicLayout').then((m) => ({ Component: m.PublicLayout })),
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
                  lazy: () =>
                    import('@/layouts/admin/AdminLayout').then((m) => ({ Component: m.AdminLayout })),
                  children: [
                    {
                      index: true,
                      lazy: () =>
                        import('@/features/admin/DashboardPage').then((m) => ({
                          Component: m.DashboardPage,
                        })),
                    },
                    {
                      path: 'he-thong',
                      lazy: () =>
                        import('@/features/system/StatusPage').then((m) => ({ Component: m.StatusPage })),
                    },
                    ...adminContentRoutes,
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
      ],
    },
  ])
}
