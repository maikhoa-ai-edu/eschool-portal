import { useQuery } from '@tanstack/react-query'
import { HOMEPAGE_KEY, fetchSlides } from '@/features/homepage/api'
import { HeroSlider } from '@/features/homepage/HeroSlider'
import {
  AlbumsBlock,
  AnnouncementsBox,
  CategoryNews,
  DocumentsBox,
  FeaturedNews,
  LatestNews,
  VisitCounterBox,
} from '@/features/homepage/HomeSections'
import { useFeaturedNews } from '@/features/homepage/hooks'
import { visibleSections, type HomepageSection } from '@/features/site/homepage-settings'
import { useSite } from '@/features/site/site-context'

/** Trang chủ: slide + các khối theo cấu hình (thứ tự, bật/tắt, số lượng) trong trang quản trị Trang chủ. */
export function HomePage() {
  const { identity, homepage, isModuleEnabled } = useSite()
  const main = visibleSections(homepage, 'main', isModuleEnabled)
  const sidebar = visibleSections(homepage, 'sidebar', isModuleEnabled)

  const slides = useQuery({
    queryKey: [...HOMEPAGE_KEY, 'slides', 'public'],
    queryFn: () => fetchSlides(true),
    enabled: homepage.show_slides,
  })
  // Khối "Tin mới nhất" bỏ các bài đã hiện ở "Tin nổi bật" (cùng khóa truy vấn nên không tải hai lần)
  const featuredSection = main.find((s) => s.key === 'featured_news')
  const featured = useFeaturedNews(featuredSection?.limit ?? 0, Boolean(featuredSection))
  const featuredIds = featured.data?.map((n) => n.id) ?? []

  const renderMain = (section: HomepageSection) => {
    switch (section.key) {
      case 'featured_news':
        return <FeaturedNews key={section.key} section={section} />
      case 'latest_news':
        return <LatestNews key={section.key} section={section} excludeIds={featuredIds} />
      case 'category_news':
        return <CategoryNews key={section.key} section={section} categoryIds={homepage.category_ids} />
      case 'albums':
        return <AlbumsBlock key={section.key} section={section} />
      default:
        return null
    }
  }
  const renderSidebar = (section: HomepageSection) => {
    switch (section.key) {
      case 'announcements':
        return <AnnouncementsBox key={section.key} section={section} />
      case 'documents':
        return <DocumentsBox key={section.key} section={section} />
      case 'visit_counter':
        return <VisitCounterBox key={section.key} section={section} />
      default:
        return null
    }
  }

  return (
    <div>
      <h1 className="sr-only">{identity.school_name}</h1>
      {homepage.show_slides && slides.data && slides.data.length > 0 && (
        <HeroSlider slides={slides.data} interval={homepage.slide_interval} />
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">{main.map(renderMain)}</div>
        {sidebar.length > 0 && <aside className="space-y-5">{sidebar.map(renderSidebar)}</aside>}
      </div>
    </div>
  )
}
