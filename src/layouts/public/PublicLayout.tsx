import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { MainNav } from './MainNav'
import { MarqueeBar } from './MarqueeBar'
import { MobileBottomBar } from './MobileBottomBar'
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
      {/* Từ lg trở lên lớp này biến mất: đầu trang cuộn đi, chỉ menu dính như cũ */}
      <div className="sticky top-0 z-20 lg:contents [@media(max-height:599px)]:static">
        <SiteHeader />
        <MainNav />
      </div>
      <MarqueeBar />
      {/* Cao ít nhất một màn hình: chân trang không lọt vào khung nhìn rồi bị đẩy xuống khi nội dung tải xong */}
      <main id="noi-dung" className="mx-auto min-h-screen w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileBottomBar />
    </div>
  )
}
