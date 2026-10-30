import { useEffect } from 'react'
import { useSite } from '@/features/site/site-context'

/** Đặt tiêu đề tab "Tiêu đề | Tên trường"; trả lại tên trường khi rời trang. */
export function usePageTitle(title: string | null | undefined) {
  const { identity } = useSite()
  useEffect(() => {
    if (!title) return
    document.title = `${title} | ${identity.school_name}`
    return () => {
      document.title = identity.school_name
    }
  }, [title, identity.school_name])
}
