import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bell, FileText, Newspaper, Search } from 'lucide-react'
import { PublicPageHeader, PublicQueryState } from '@/components/content/PublicPage'
import { toSearchQuery } from '@/features/documents/api'
import { searchPublicNews } from '@/features/news/api'
import { useSite } from '@/features/site/site-context'
import { formatDate } from '@/lib/format'
import { getSupabase } from '@/lib/supabase'
import { usePageTitle } from '@/lib/use-page-title'

const LIMIT = 20

async function searchDocuments(q: string) {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title, issue_date')
    .eq('status', 'published')
    .textSearch('search_vector', toSearchQuery(q), { type: 'websearch', config: 'simple' })
    .limit(LIMIT)
  if (error) throw error
  return data
}

/** Thông báo chưa có cột tìm kiếm không dấu nên tìm theo đúng chữ trong tiêu đề. */
async function searchAnnouncements(q: string) {
  const now = new Date().toISOString()
  const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`
  const { data, error } = await getSupabase()
    .from('announcements')
    .select('id, title, published_at')
    .eq('status', 'published')
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .ilike('title', pattern)
    .order('published_at', { ascending: false })
    .limit(LIMIT)
  if (error) throw error
  return data
}

function Group({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: Array<{ id: string; to: string; title: string; date: string | null }>
}) {
  if (rows.length === 0) return null
  return (
    <section className="rounded-xl bg-surface p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-primary">
        {icon} {title} ({rows.length})
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="py-2">
            <Link to={r.to} className="font-medium hover:text-primary">
              {r.title}
            </Link>
            {r.date && <p className="text-xs text-muted">{formatDate(r.date)}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Tìm chung tin, thông báo, văn bản; module đang tắt thì bỏ qua. */
export function SearchPage() {
  const { isModuleEnabled } = useSite()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [text, setText] = useState(q)
  usePageTitle('Tìm kiếm')

  const { data, isPending, error } = useQuery({
    queryKey: ['search', q],
    enabled: q.length > 0,
    queryFn: async () => {
      const [news, announcements, documents] = await Promise.all([
        isModuleEnabled('news') ? searchPublicNews(q) : [],
        isModuleEnabled('announcements') ? searchAnnouncements(q) : [],
        isModuleEnabled('documents') ? searchDocuments(q) : [],
      ])
      return { news, announcements, documents }
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) setParams({ q: text.trim() })
  }
  const total = data ? data.news.length + data.announcements.length + data.documents.length : 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PublicPageHeader title="Tìm kiếm" crumbs={[]} />
      <form role="search" onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập từ khóa..."
          aria-label="Từ khóa tìm kiếm"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-white"
        >
          <Search className="h-4 w-4" aria-hidden /> Tìm
        </button>
      </form>
      {q && (isPending || error) && <PublicQueryState isPending={isPending} error={error} />}
      {data && (
        <>
          <p className="text-sm text-muted" role="status">
            {total === 0 ? `Không tìm thấy kết quả cho "${q}".` : `Có ${total} kết quả cho "${q}".`}
          </p>
          <Group
            title="Tin tức"
            icon={<Newspaper className="h-4 w-4" aria-hidden />}
            rows={data.news.map((n) => ({
              id: n.id,
              to: `/tin-tuc/${n.slug}`,
              title: n.title,
              date: n.published_at,
            }))}
          />
          <Group
            title="Thông báo"
            icon={<Bell className="h-4 w-4" aria-hidden />}
            rows={data.announcements.map((a) => ({
              id: a.id,
              to: `/thong-bao/${a.id}`,
              title: a.title,
              date: a.published_at,
            }))}
          />
          <Group
            title="Văn bản"
            icon={<FileText className="h-4 w-4" aria-hidden />}
            rows={data.documents.map((d) => ({
              id: d.id,
              to: `/van-ban/${d.id}`,
              title: d.title,
              date: d.issue_date,
            }))}
          />
        </>
      )}
    </div>
  )
}
