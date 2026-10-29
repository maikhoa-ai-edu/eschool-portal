import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { MainNav } from './MainNav'
import { MarqueeBar } from './MarqueeBar'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

const VISIT_KEY = 'eschool:visit-recorded'

/** Ghi nhận 1 lượt truy cập cho mỗi phiên trình duyệt. */
function useRecordVisit() {
  const queryClient = useQueryClient()
  useEffect(() => {
    try {
      if (sessionStorage.getItem(VISIT_KEY)) return
      sessionStorage.setItem(VISIT_KEY, '1')
    } catch {
      // Trình duyệt chặn sessionStorage: vẫn đếm, chấp nhận đếm trùng
    }
    // Ghi xong mới tải lại số liệu ở chân trang, để lượt vừa vào được tính
    void getSupabase()
      .rpc('record_visit')
      .then(() => queryClient.invalidateQueries({ queryKey: ['visit-stats'] }))
  }, [queryClient])
}

export function PublicLayout() {
  useRecordVisit()
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Bỏ qua menu, đến nội dung
      </a>
      <SiteHeader />
      <MainNav />
      <MarqueeBar />
      <main id="noi-dung" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
