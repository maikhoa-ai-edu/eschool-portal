import { useQuery } from '@tanstack/react-query'
import { NEWS_KEY } from '@/features/news/api'
import { fetchFeaturedNews } from './api'

/** Dùng chung giữa trang chủ và khối Tin nổi bật (cùng khóa nên chỉ tải một lần). */
export function useFeaturedNews(limit: number, enabled: boolean) {
  return useQuery({
    queryKey: [...NEWS_KEY, 'home', 'featured', limit],
    queryFn: () => fetchFeaturedNews(limit),
    enabled,
  })
}
