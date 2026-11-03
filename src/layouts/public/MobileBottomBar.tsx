import { NavLink } from 'react-router'
import { isExternalUrl } from '@/features/site/menu'
import { MenuIcon } from '@/features/site/menu-icons'
import { cn } from '@/lib/cn'
import { useMobileBarItems } from './mobile-bar'

const ITEM =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight'

/** Menu cố định ở đáy màn hình điện thoại (menu "mobile" trong CSDL). Không có mục nào thì không hiện. */
export function MobileBottomBar() {
  const items = useMobileBarItems()
  if (items.length === 0) return null

  return (
    <>
      {/* Chừa chỗ để thanh cố định không che chân trang */}
      <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-primary md:hidden" aria-hidden />
      <nav
        aria-label="Menu nhanh"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-2px_8px_rgb(0_0_0/0.08)] md:hidden"
      >
        <ul className="flex h-14">
          {items.map((item) => {
            const body = (
              <>
                <MenuIcon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center">{item.title}</span>
              </>
            )
            return (
              <li key={item.id} className="flex min-w-0 flex-1">
                {isExternalUrl(item.url) ? (
                  <a
                    href={item.url}
                    target={item.open_in_new_tab ? '_blank' : undefined}
                    rel={item.open_in_new_tab ? 'noopener noreferrer' : undefined}
                    className={cn(ITEM, 'text-muted')}
                  >
                    {body}
                  </a>
                ) : (
                  <NavLink
                    to={item.url}
                    end={item.url === '/'}
                    className={({ isActive }) =>
                      cn(ITEM, isActive ? 'font-semibold text-primary' : 'text-muted')
                    }
                  >
                    {body}
                  </NavLink>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
