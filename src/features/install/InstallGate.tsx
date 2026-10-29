import { Navigate, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { fetchInstallStatus, INSTALL_STATUS_QUERY_KEY } from './api'

/**
 * Đã có cấu hình kết nối nhưng CSDL chưa khởi tạo hoặc chưa cài xong: dẫn về trình cài đặt.
 * Lỗi mạng thì không chặn (trang vẫn hiện với dữ liệu mặc định, như SiteProvider).
 */
export function InstallGate() {
  const query = useQuery({
    queryKey: INSTALL_STATUS_QUERY_KEY,
    queryFn: fetchInstallStatus,
    staleTime: 5 * 60_000,
  })

  if (query.isPending) return <FullPageSpinner />
  if (query.data && (query.data.kind === 'missing' || !query.data.status.completed)) {
    return <Navigate to="/install" replace />
  }
  return <Outlet />
}
