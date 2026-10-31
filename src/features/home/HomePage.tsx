import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Alert } from '@/components/ui/Alert'
import { HOMEPAGE_KEY, fetchLatestNewsWithImage, fetchSlides } from '@/features/homepage/api'
import { FULL_SLIDE_ASPECT, HeroSlider, SPLIT_SLIDE_ASPECT } from '@/features/homepage/HeroSlider'
import { TopicBanner } from '@/features/homepage/TopicBanner'
import {
  AlbumsBlock,
  AnnouncementsBox,
  CategoryNews,
  DocumentsBox,
  FeaturedNews,
  LatestNews,
  ShortcutsBlock,
  VisitCounterBox,
} from '@/features/homepage/HomeSections'
import { useFeaturedNews } from '@/features/homepage/hooks'
import {
  bannerImageSizes,
  HERO_STRIP_COUNT,
  HeadingStyleContext,
  railCount,
} from '@/features/homepage/layout'
import { HeroRail, HeroStrip, HeroTabsRail } from '@/features/homepage/NewsBlock'
import { readPreviewDraft } from '@/features/homepage/preview'
import {
  groupRows,
  visibleSections,
  type HomepageSection,
  type HomepageZone,
} from '@/features/site/homepage-settings'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'

/** Trang chủ: slide + các khối theo cấu hình (vùng, thứ tự, kiểu hiển thị) trong trang quản trị Trang chủ. */
export function HomePage() {
  const site = useSite()
  const { identity, isModuleEnabled } = site
  const [params] = useSearchParams()
  const isPreview = params.has('xem-truoc')
  // Xem trước bố cục chưa lưu: bản nháp nằm trong trình duyệt của người đang sửa, không ghi vào CSDL
  const draft = useMemo(() => (isPreview ? readPreviewDraft() : null), [isPreview])
  const homepage = draft ?? site.homepage

  const zone = (z: HomepageZone) => visibleSections(homepage, z, isModuleEnabled)
  const top = zone('top')
  const main = zone('main')
  const sidebar = zone('sidebar')
  const bottom = zone('bottom')

  const slides = useQuery({
    queryKey: [...HOMEPAGE_KEY, 'slides', 'public'],
    queryFn: () => fetchSlides(true),
    enabled: homepage.show_slides,
  })
  const hasSlides = homepage.show_slides && (slides.isPending || (slides.data?.length ?? 0) > 0)
  const wantsRail = homepage.hero !== 'full' && isModuleEnabled('news') && hasSlides
  const portal = homepage.hero === 'portal' && wantsRail

  // Cột Tiêu điểm và khối "Tin nổi bật" dùng chung một truy vấn; "Tin mới nhất" bỏ các bài đã hiện ở hai nơi này
  const featuredSection = [...top, ...main, ...sidebar, ...bottom].find((s) => s.key === 'featured_news')
  const railLimit = railCount(homepage.hero)
  const featuredTotal = railLimit + (featuredSection?.limit ?? 0)
  const featured = useFeaturedNews(featuredTotal, Boolean(featuredSection) || wantsRail)
  const featuredData = featured.data ?? []
  const railItems = wantsRail ? featuredData.slice(0, railLimit) : []
  const featuredItems = featuredData.slice(railItems.length, railItems.length + (featuredSection?.limit ?? 0))
  // Lấy dư để sau khi bỏ bài đã có ở cột phải vẫn đủ số thẻ
  const stripQuery = useQuery({
    queryKey: [...HOMEPAGE_KEY, 'strip', HERO_STRIP_COUNT + railLimit],
    queryFn: () => fetchLatestNewsWithImage(HERO_STRIP_COUNT + railLimit),
    enabled: portal,
  })
  const railIds = railItems.map((n) => n.id)
  const stripItems = portal
    ? (stripQuery.data ?? []).filter((n) => !railIds.includes(n.id)).slice(0, HERO_STRIP_COUNT)
    : []
  const shownIds = [...railItems, ...(featuredSection ? featuredItems : []), ...stripItems].map((n) => n.id)
  const split = wantsRail && (featured.isPending || featuredData.length > 0)

  const renderBlock = (section: HomepageSection) => {
    switch (section.key) {
      case 'featured_news':
        return (
          <FeaturedNews
            key={section.id}
            section={section}
            items={featuredItems}
            isPending={featured.isPending}
          />
        )
      case 'latest_news':
        return (
          <LatestNews
            key={section.id}
            section={section}
            excludeIds={shownIds}
            excludeCount={featuredTotal + (portal ? HERO_STRIP_COUNT : 0)}
            excludePending={(featuredTotal > 0 && featured.isPending) || (portal && stripQuery.isPending)}
          />
        )
      case 'category_news':
        return <CategoryNews key={section.id} section={section} />
      case 'albums':
        return <AlbumsBlock key={section.id} section={section} />
      case 'topic_banner':
        return (
          <TopicBanner
            key={section.id}
            banner={homepage.banner}
            imageSizes={bannerImageSizes(section.zone, section.half)}
          />
        )
      case 'shortcuts':
        return <ShortcutsBlock key={section.id} section={section} />
      case 'announcements':
        return (
          <AnnouncementsBox
            key={section.id}
            section={section}
            highlightLatest={homepage.highlight_latest_announcement}
          />
        )
      case 'documents':
        return <DocumentsBox key={section.id} section={section} ticker={homepage.documents_ticker} />
      case 'visit_counter':
        return <VisitCounterBox key={section.id} section={section} />
    }
  }

  /** Hai khối nửa xếp song song; khối bên cạnh không có nội dung thì khối còn lại tự chiếm cả hàng. */
  const renderRows = (sections: HomepageSection[]) =>
    groupRows(sections).map((row) =>
      row.length === 2 ? (
        <div
          key={row[0]!.id}
          className="grid items-start gap-8 md:grid-cols-2 md:[&>:only-child]:col-span-2 [&>*]:min-w-0"
        >
          {row.map(renderBlock)}
        </div>
      ) : (
        renderBlock(row[0]!)
      ),
    )

  const slider = homepage.show_slides && slides.data && slides.data.length > 0 && (
    <HeroSlider slides={slides.data} interval={homepage.slide_interval} split={split} />
  )
  // Giữ chỗ đúng kích thước slide để nội dung bên dưới không bị đẩy khi ảnh hiện ra
  const sliderPlaceholder = homepage.show_slides && slides.isPending && (
    <div
      className={cn('rounded-2xl bg-primary/10', split ? SPLIT_SLIDE_ASPECT : ['mb-6', FULL_SLIDE_ASPECT])}
      aria-hidden
    />
  )

  return (
    <HeadingStyleContext.Provider value={homepage.heading_style}>
      <h1 className="sr-only">{identity.school_name}</h1>
      {isPreview && (
        <div className="mb-4">
          <Alert
            tone="warning"
            title={draft ? 'Bản xem trước bố cục, chưa lưu' : 'Không còn bản nháp để xem trước'}
          >
            {draft ? 'Chỉ bạn thấy bố cục này trên trình duyệt này. ' : ''}
            <Link to="/admin/trang-chu?tab=bo-cuc" className="underline">
              Quay lại trang Bố cục
            </Link>
          </Alert>
        </div>
      )}
      {split ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0">
            {slider}
            {sliderPlaceholder}
            {portal && (
              <HeroStrip items={stripItems} isPending={stripQuery.isPending || featured.isPending} />
            )}
          </div>
          {portal ? (
            <HeroTabsRail items={railItems} isPending={featured.isPending} tabs={homepage.hero_tabs} />
          ) : (
            <HeroRail items={railItems} isPending={featured.isPending} />
          )}
        </div>
      ) : (
        <>
          {slider}
          {sliderPlaceholder}
        </>
      )}
      {top.length > 0 && <div className="mb-8 space-y-8">{renderRows(top)}</div>}
      <div className={cn('grid gap-8', sidebar.length > 0 && 'lg:grid-cols-[1fr_320px]')}>
        <div className="min-w-0 space-y-8">{renderRows(main)}</div>
        {sidebar.length > 0 && <aside className="min-w-0 space-y-5">{sidebar.map(renderBlock)}</aside>}
      </div>
      {bottom.length > 0 && <div className="mt-8 space-y-8">{renderRows(bottom)}</div>}
    </HeadingStyleContext.Provider>
  )
}
