import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Images, Plus } from 'lucide-react'
import { AdminPageHeader, QueryState } from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/format'
import { ALBUMS_KEY, fetchAdminAlbums } from '../api'

export function AlbumListPage() {
  const { data, isPending, error } = useQuery({
    queryKey: [...ALBUMS_KEY, 'admin'],
    queryFn: fetchAdminAlbums,
  })

  return (
    <div>
      <AdminPageHeader
        title="Thư viện ảnh"
        description="Mỗi album là một sự kiện, hoạt động của nhà trường."
        actions={
          <Link to="/admin/thu-vien-anh/moi" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Tạo album
          </Link>
        }
      />
      <QueryState isPending={isPending} error={error} />
      {data && data.length === 0 && (
        <EmptyState icon={Images} title="Chưa có album nào">
          Tạo album rồi tải ảnh hoạt động lên.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.map((album) => (
            <li key={album.id}>
              <Link
                to={`/admin/thu-vien-anh/${album.id}`}
                className="block overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
              >
                <div className="aspect-[4/3] bg-bg">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted">
                      <Images className="h-10 w-10" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="font-semibold">{album.title}</p>
                  <p className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {album.imageCount} ảnh{album.event_date && ` · ${formatDate(album.event_date)}`}
                    </span>
                    {album.status === 'published' ? (
                      <Badge tone="success">Đã đăng</Badge>
                    ) : (
                      <Badge>Nháp</Badge>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
