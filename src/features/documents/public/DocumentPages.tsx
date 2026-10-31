import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileText, Folder, Search } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import {
  DraftPreviewNotice,
  PublicPageHeader,
  PublicQueryState,
  SidebarBox,
  WithSidebar,
} from '@/components/content/PublicPage'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { readPage } from '@/components/ui/page-utils'
import {
  CONTENT_GROUPS_KEY,
  fetchContentGroups,
  groupWithChildren,
  type ContentGroup,
} from '@/features/content-groups/api'
import { useSite } from '@/features/site/site-context'
import { cn } from '@/lib/cn'
import { formatDate, formatFileSize, formatNumber } from '@/lib/format'
import { usePageTitle } from '@/lib/use-page-title'
import {
  DOCUMENT_PAGE_SIZE,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  DOCUMENTS_KEY,
  documentDownloadUrl,
  documentExtension,
  documentTypeLabel,
  documentViewUrl,
  fetchDocument,
  fetchPublicDocuments,
  fetchTopDocuments,
  isDocumentType,
  recordDocumentView,
  recordDownload,
} from '../api'

/** Nút tải: tăng lượt tải rồi để trình duyệt mở liên kết như bình thường. */
function DownloadLink({
  doc,
  className,
  children,
}: {
  doc: { id: string; file_path: string; file_name: string }
  className?: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  return (
    <a
      href={documentDownloadUrl(doc)}
      className={className}
      onClick={() =>
        void recordDownload(doc.id).then(() => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }))
      }
    >
      {children}
    </a>
  )
}

const FOLDER_PARAM = 'thu-muc'

function useFolders() {
  return useQuery({
    queryKey: [...CONTENT_GROUPS_KEY, 'document'],
    queryFn: () => fetchContentGroups('document'),
  })
}

function TopDocuments({ by, title }: { by: 'view_count' | 'download_count'; title: string }) {
  const { data = [] } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'top', by],
    queryFn: () => fetchTopDocuments(by),
  })
  if (data.length === 0) return null
  return (
    <SidebarBox title={title}>
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.id}>
            <Link to={`/van-ban/${d.id}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
              {d.title}
            </Link>
            <span className="flex items-center gap-1 text-xs text-muted">
              {by === 'view_count' ? (
                <Eye className="h-3 w-3" aria-hidden />
              ) : (
                <Download className="h-3 w-3" aria-hidden />
              )}
              {formatNumber(d[by])}
            </span>
          </li>
        ))}
      </ul>
    </SidebarBox>
  )
}

function FolderTree({ folders, current }: { folders: ContentGroup[]; current?: string | null }) {
  if (folders.length === 0) return null
  const row = (id: string | null, name: string, child = false) => {
    const active = (current ?? null) === id
    return (
      <Link
        to={id ? `/van-ban?${FOLDER_PARAM}=${id}` : '/van-ban'}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-bg',
          child && 'ml-4',
          active && 'bg-primary/10 font-semibold text-primary',
        )}
      >
        <Folder className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {name}
      </Link>
    )
  }
  return (
    <SidebarBox title="Thư mục văn bản">
      <ul>
        <li>{row(null, 'Tất cả văn bản')}</li>
        {folders
          .filter((f) => !f.parent_id)
          .map((root) => (
            <li key={root.id}>
              {row(root.id, root.name)}
              <ul>
                {folders
                  .filter((f) => f.parent_id === root.id)
                  .map((f) => (
                    <li key={f.id}>{row(f.id, f.name, true)}</li>
                  ))}
              </ul>
            </li>
          ))}
      </ul>
    </SidebarBox>
  )
}

function DocumentSidebar({ current }: { current?: string | null }) {
  const { data: folders = [] } = useFolders()
  return (
    <>
      <FolderTree folders={folders} current={current} />
      <TopDocuments by="view_count" title="Xem nhiều" />
      <TopDocuments by="download_count" title="Tải nhiều" />
    </>
  )
}

export function DocumentListPage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params)
  const typeParam = params.get('loai')
  const type = isDocumentType(typeParam) ? typeParam : null
  const query = (params.get('q') ?? '').trim()
  const [draft, setDraft] = useState(query)
  usePageTitle('Văn bản')
  const { chrome } = useSite()
  const folder = chrome.content_sidebar ? params.get(FOLDER_PARAM) : null
  const folders = useFolders()
  const folderIds = folder ? groupWithChildren(folders.data ?? [], folder) : undefined

  const { data, isPending, error } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'public', { page, type, query, folderIds }],
    queryFn: () => fetchPublicDocuments({ page, type, query, folderIds }),
    // Chưa có cây thư mục thì chưa biết thư mục con
    enabled: !folder || folders.isSuccess,
  })

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params)
    p.delete('trang')
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p)
  }

  const chip = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-sm font-medium',
      active ? 'bg-primary text-white' : 'bg-surface text-text hover:bg-primary/10',
    )

  const body = (
    <div>
      <PublicPageHeader title="Văn bản" crumbs={[{ label: 'Văn bản' }]} />
      <div className="mb-4 space-y-3">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            update('q', draft.trim())
          }}
        >
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tìm theo tên, số hiệu, người ký..."
            aria-label="Tìm văn bản"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <button type="submit" className={buttonClasses('primary')}>
            <Search className="h-4 w-4" aria-hidden /> Tìm
          </button>
        </form>
        <div className="flex flex-wrap gap-2" aria-label="Lọc theo loại văn bản">
          <button
            type="button"
            className={chip(!type)}
            aria-pressed={!type}
            onClick={() => update('loai', '')}
          >
            Tất cả
          </button>
          {DOCUMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={chip(type === t)}
              aria-pressed={type === t}
              onClick={() => update('loai', t)}
            >
              {DOCUMENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <PublicQueryState isPending={isPending} error={error} />
      {data && data.items.length === 0 && (
        <EmptyState
          icon={FileText}
          title={query || type || folder ? 'Không có văn bản phù hợp' : 'Chưa có văn bản'}
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {data.items.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold uppercase text-primary">
                  {documentExtension(doc.file_name) || 'file'}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/van-ban/${doc.id}`}
                    className="font-semibold hover:text-primary hover:underline"
                  >
                    {doc.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>{documentTypeLabel(doc.document_type)}</span>
                    {doc.document_number && <span>Số: {doc.document_number}</span>}
                    {doc.issue_date && <span>Ban hành: {formatDate(doc.issue_date)}</span>}
                    <span>{formatNumber(doc.download_count)} lượt tải</span>
                  </p>
                </div>
                <DownloadLink doc={doc} className={buttonClasses('outline', 'sm', 'shrink-0')}>
                  <Download className="h-4 w-4" aria-hidden /> Tải về
                </DownloadLink>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(data.total / DOCUMENT_PAGE_SIZE)} />
        </>
      )}
    </div>
  )
  return chrome.content_sidebar ? (
    <WithSidebar sidebar={<DocumentSidebar current={folder} />}>{body}</WithSidebar>
  ) : (
    body
  )
}

export function DocumentDetailPage() {
  const { id = '' } = useParams()
  const isUuid = /^[0-9a-f-]{36}$/i.test(id)
  const {
    data: doc,
    isPending,
    error,
  } = useQuery({
    queryKey: [...DOCUMENTS_KEY, 'public', 'detail', id],
    queryFn: () => fetchDocument(id),
    enabled: isUuid,
  })
  usePageTitle(doc?.title)
  const { chrome } = useSite()
  const published = doc?.status === 'published'
  useEffect(() => {
    if (published) void recordDocumentView(id)
  }, [id, published])

  if (!isUuid) return <NotFound />
  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  if (!doc) return <NotFound />

  const rows: Array<[string, string | null]> = [
    ['Số hiệu', doc.document_number],
    ['Loại văn bản', documentTypeLabel(doc.document_type)],
    ['Cơ quan ban hành', doc.issuing_authority],
    ['Người ký', doc.signer],
    ['Ngày ban hành', formatDate(doc.issue_date) || null],
    ['Ngày hiệu lực', formatDate(doc.effective_date) || null],
    ['Dung lượng', formatFileSize(doc.file_size)],
  ]

  const body = (
    <>
      {doc.status !== 'published' && <DraftPreviewNotice />}
      <PublicPageHeader title={doc.title} crumbs={[{ label: 'Văn bản', to: '/van-ban' }]} />
      <div className="space-y-5 rounded-xl bg-surface p-4 shadow-sm sm:p-6">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows
            .filter((r): r is [string, string] => Boolean(r[1]))
            .map(([label, value]) => (
              <div key={label} className="flex gap-2 border-b border-border py-1.5">
                <dt className="w-36 shrink-0 text-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
        </dl>
        {doc.excerpt && <p className="whitespace-pre-line leading-relaxed">{doc.excerpt}</p>}
        <DownloadLink doc={doc} className={buttonClasses('primary')}>
          <Download className="h-4 w-4" aria-hidden /> Tải về ({doc.file_name})
        </DownloadLink>
        {doc.mime_type === 'application/pdf' && (
          <iframe
            src={documentViewUrl(doc)}
            title={`Xem trước: ${doc.title}`}
            className="h-[75vh] w-full rounded-lg border border-border"
          />
        )}
      </div>
    </>
  )
  return chrome.content_sidebar ? (
    <WithSidebar sidebar={<DocumentSidebar current={doc.folder_id} />}>{body}</WithSidebar>
  ) : (
    <div className="mx-auto max-w-5xl">{body}</div>
  )
}
