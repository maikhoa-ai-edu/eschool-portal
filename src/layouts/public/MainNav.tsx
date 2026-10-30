import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Menu, X } from 'lucide-react'
import { fetchMenu, hideDisabledModules, isExternalUrl, type MenuNode } from '@/features/site/menu'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'

function MenuLink({
  node,
  className,
  onNavigate,
}: {
  node: MenuNode
  className?: string
  onNavigate?: () => void
}) {
  if (isExternalUrl(node.url)) {
    return (
      <a
        href={node.url}
        className={className}
        target={node.open_in_new_tab ? '_blank' : undefined}
        rel={node.open_in_new_tab ? 'noopener noreferrer' : undefined}
      >
        {node.title}
      </a>
    )
  }
  return (
    <NavLink
      to={node.url}
      end={node.url === '/'}
      onClick={onNavigate}
      className={({ isActive }) => cn(className, isActive && 'is-active')}
    >
      {node.title}
    </NavLink>
  )
}

function DesktopItem({ node }: { node: MenuNode }) {
  const base =
    'flex h-12 items-center gap-1 px-3 text-sm font-semibold text-white hover:bg-white/10 [&.is-active]:bg-accent'
  if (node.children.length === 0) return <MenuLink node={node} className={base} />

  return (
    <div className="group relative">
      <button type="button" className={base} aria-haspopup="true">
        {node.title} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div className="invisible absolute left-0 top-full z-30 min-w-56 rounded-b-lg border border-border bg-surface py-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {/* Mục cha có trang riêng (vd Giới thiệu): vẫn vào được trang đó từ danh sách con */}
        {node.url !== '/' && (
          <MenuLink
            node={node}
            className="block border-b border-border px-4 py-2 text-sm font-semibold text-text hover:bg-bg [&.is-active]:text-primary"
          />
        )}
        {node.children.map((child) => (
          <MenuLink
            key={child.id}
            node={child}
            className="block px-4 py-2 text-sm text-text hover:bg-bg [&.is-active]:font-semibold [&.is-active]:text-primary"
          />
        ))}
      </div>
    </div>
  )
}

function MobileItems({
  nodes,
  depth,
  onNavigate,
}: {
  nodes: MenuNode[]
  depth: number
  onNavigate: () => void
}) {
  return (
    <ul className={cn(depth > 0 && 'border-l border-white/20 ml-4')}>
      {nodes.map((node) => (
        <li key={node.id}>
          <MenuLink
            node={node}
            onNavigate={onNavigate}
            className="block px-4 py-3 text-sm font-medium text-white [&.is-active]:text-accent"
          />
          {node.children.length > 0 && (
            <MobileItems nodes={node.children} depth={depth + 1} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  )
}

export function MainNav() {
  const location = useLocation()
  // Menu chỉ mở trên trang đã bấm mở; chuyển trang là tự đóng (không cần effect)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === location.pathname
  const { isModuleEnabled } = useSite()
  const { data = [] } = useQuery({ queryKey: ['menu', 'main'], queryFn: () => fetchMenu('main') })
  const nodes = hideDisabledModules(data, isModuleEnabled)

  return (
    <nav aria-label="Menu chính" className="sticky top-0 z-20 bg-primary shadow-md">
      <div className="mx-auto flex max-w-7xl items-center px-2">
        <div className="hidden flex-1 items-center lg:flex">
          {nodes.map((node) => (
            <DesktopItem key={node.id} node={node} />
          ))}
        </div>
        <div className="flex h-12 flex-1 items-center justify-between lg:hidden">
          <span className="px-2 text-sm font-bold uppercase tracking-wide text-white/90">Danh mục</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setOpenPath(open ? null : location.pathname)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div
          id="mobile-menu"
          className="max-h-[70vh] overflow-y-auto border-t border-white/10 bg-primary lg:hidden"
        >
          <MobileItems nodes={nodes} depth={0} onNavigate={() => setOpenPath(null)} />
        </div>
      )}
    </nav>
  )
}
