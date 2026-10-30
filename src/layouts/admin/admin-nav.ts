import {
  Activity,
  ArchiveRestore,
  Bell,
  CloudDownload,
  FileText,
  FolderTree,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  ListTree,
  Newspaper,
  NotebookText,
  Palette,
  ScrollText,
  Settings,
  Sparkles,
  ToggleLeft,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/features/site/settings'

export interface AdminNavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Cần quyền này mới thấy (CSDL vẫn kiểm tra lại) */
  permission?: string
  /** Ẩn khi module bị tắt */
  module?: ModuleKey
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Tổng quan',
    items: [{ label: 'Bảng điều khiển', to: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Nội dung',
    items: [
      {
        label: 'Tin tức',
        to: '/admin/tin-tuc',
        icon: Newspaper,
        permission: 'news.create',
        module: 'news',
      },
      {
        label: 'Chuyên mục & thẻ',
        to: '/admin/chuyen-muc',
        icon: FolderTree,
        permission: 'news.manage_taxonomy',
        module: 'news',
      },
      {
        label: 'Thông báo',
        to: '/admin/thong-bao',
        icon: Bell,
        permission: 'announcements.manage',
        module: 'announcements',
      },
      {
        label: 'Văn bản',
        to: '/admin/van-ban',
        icon: FileText,
        permission: 'documents.manage',
        module: 'documents',
      },
      {
        label: 'Thư viện ảnh',
        to: '/admin/thu-vien-anh',
        icon: Images,
        permission: 'media.manage',
        module: 'albums',
      },
      {
        label: 'Trang tĩnh',
        to: '/admin/trang',
        icon: NotebookText,
        permission: 'pages.manage',
        module: 'pages',
      },
      {
        label: 'Chuyên đề',
        to: '/admin/chuyen-de',
        icon: Sparkles,
        permission: 'topics.manage',
        module: 'topics',
      },
    ],
  },
  {
    label: 'Giao diện',
    items: [
      {
        label: 'Trang chủ',
        to: '/admin/trang-chu',
        icon: LayoutTemplate,
        permission: 'homepage.manage',
      },
      { label: 'Menu', to: '/admin/menu', icon: ListTree, permission: 'menus.manage' },
      { label: 'Nhận diện', to: '/admin/nhan-dien', icon: Palette, permission: 'settings.manage' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      {
        label: 'Thông tin trường',
        to: '/admin/cai-dat',
        icon: Settings,
        permission: 'settings.manage',
      },
      { label: 'Module', to: '/admin/module', icon: ToggleLeft, permission: 'modules.manage' },
      { label: 'Tài khoản', to: '/admin/tai-khoan', icon: Users, permission: 'users.manage' },
      { label: 'Nhật ký', to: '/admin/nhat-ky', icon: ScrollText, permission: 'audit.view' },
      { label: 'Sao lưu', to: '/admin/sao-luu', icon: ArchiveRestore, permission: 'backup.manage' },
      { label: 'Cập nhật', to: '/admin/cap-nhat', icon: CloudDownload, permission: 'backup.manage' },
      { label: 'Trạng thái hệ thống', to: '/admin/he-thong', icon: Activity },
    ],
  },
]

/** Lọc menu theo quyền và module đang bật; bỏ nhóm rỗng. */
export function visibleAdminNav(
  can: (permission: string) => boolean,
  isModuleEnabled: (key: ModuleKey) => boolean,
): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => (!item.permission || can(item.permission)) && (!item.module || isModuleEnabled(item.module)),
    ),
  })).filter((group) => group.items.length > 0)
}
