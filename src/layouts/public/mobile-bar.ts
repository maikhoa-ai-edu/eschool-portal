import { useQuery } from '@tanstack/react-query'
import { fetchMenu, hideDisabledModules } from '@/features/site/menu'
import { useSite } from '@/features/site/site-context'

/** Thanh đáy chứa được tối đa từng này mục mà chữ vẫn đọc được trên màn hình hẹp. */
export const MOBILE_BAR_MAX_ITEMS = 5

/** Các mục của thanh đáy; rỗng thì thanh không hiện. */
export function useMobileBarItems() {
  const { isModuleEnabled } = useSite()
  const { data = [] } = useQuery({ queryKey: ['menu', 'mobile'], queryFn: () => fetchMenu('mobile') })
  return hideDisabledModules(data, isModuleEnabled).slice(0, MOBILE_BAR_MAX_ITEMS)
}
