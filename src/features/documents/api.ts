import type { BadgeTone } from '@/components/ui/Badge'
import { pageRange } from '@/components/ui/page-utils'
import { DOCUMENTS_BUCKET, publicFileUrl } from '@/features/media/api'
import { removeDiacritics } from '@/lib/slug'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const DOCUMENTS_KEY = ['documents'] as const
export const DOCUMENT_PAGE_SIZE = 20

export const DOCUMENT_TYPES = [
  'ke_hoach',
  'quyet_dinh',
  'cong_van',
  'huong_dan',
  'thong_bao',
  'bieu_mau',
  'bao_cao',
  'khac',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ke_hoach: 'Kế hoạch',
  quyet_dinh: 'Quyết định',
  cong_van: 'Công văn',
  huong_dan: 'Hướng dẫn',
  thong_bao: 'Thông báo',
  bieu_mau: 'Biểu mẫu',
  bao_cao: 'Báo cáo',
  khac: 'Khác',
}

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value)
}

export function documentTypeLabel(value: string): string {
  return isDocumentType(value) ? DOCUMENT_TYPE_LABELS[value] : value
}

export const DOCUMENT_STATUSES = ['draft', 'published', 'archived'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Nháp',
  published: 'Đã ban hành',
  archived: 'Hết hiệu lực',
}
export const DOCUMENT_STATUS_TONES: Record<DocumentStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
}
export function asDocumentStatus(value: string): DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(value) ? (value as DocumentStatus) : 'draft'
}

/** Phần mở rộng -> kiểu MIME; khớp allowed_mime_types của bucket documents (migration media). */
export const DOCUMENT_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',')

export function documentExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return match ? match[1]!.toLowerCase() : ''
}

/** Kiểu MIME dựa vào phần mở rộng (Windows đôi khi không báo kiểu cho file Office). */
export function describeDocumentProblem(file: { name: string; size: number }): string | null {
  if (!DOCUMENT_MIME_BY_EXT[documentExtension(file.name)])
    return 'Chỉ nhận file PDF, Word, Excel hoặc PowerPoint.'
  if (file.size > DOCUMENT_MAX_BYTES) return 'File quá lớn (tối đa 25 MB).'
  return null
}

/** Truy vấn tìm kiếm cho cột search_vector (đã bỏ dấu trong CSDL). */
export function toSearchQuery(text: string): string {
  return removeDiacritics(text).toLowerCase().trim()
}

export function documentDownloadUrl(doc: { file_path: string; file_name: string }): string {
  return publicFileUrl(DOCUMENTS_BUCKET, doc.file_path, doc.file_name)
}

export function documentViewUrl(doc: { file_path: string }): string {
  return publicFileUrl(DOCUMENTS_BUCKET, doc.file_path)
}

const LIST_COLUMNS =
  'id, title, document_number, document_type, issuing_authority, signer, issue_date, status, is_featured, download_count, view_count, folder_id, file_name, file_size, file_path, mime_type, updated_at'

export interface DocumentFilter {
  page: number
  type: DocumentType | null
  query: string
  /** Thư mục và các thư mục con */
  folderIds?: string[]
}

export async function fetchAdminDocuments(filter: DocumentFilter) {
  let query = getSupabase()
    .from('documents')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(...pageRange(filter.page, DOCUMENT_PAGE_SIZE))
  if (filter.type) query = query.eq('document_type', filter.type)
  if (filter.query) {
    query = query.textSearch('search_vector', toSearchQuery(filter.query), {
      type: 'websearch',
      config: 'simple',
    })
  }
  const { data, error, count } = await query
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export async function fetchDocument(id: string) {
  const { data, error } = await getSupabase()
    .from('documents')
    .select(`${LIST_COLUMNS}, effective_date, excerpt, published_at`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export type DocumentRecord = NonNullable<Awaited<ReturnType<typeof fetchDocument>>>

export interface DocumentInput {
  title: string
  document_number: string
  document_type: DocumentType
  issuing_authority: string
  signer: string
  issue_date: string
  effective_date: string
  excerpt: string
  folder_id: string
  is_featured: boolean
  status: DocumentStatus
}

/** Lưu văn bản; có file mới thì tải lên trước, lưu xong mới xóa file cũ (lỗi thì xóa file vừa tải). */
export async function saveDocument(
  input: DocumentInput,
  file: File | null,
  existing: DocumentRecord | null,
): Promise<string> {
  const supabase = getSupabase()
  const storage = supabase.storage.from(DOCUMENTS_BUCKET)
  const row = {
    title: input.title,
    document_number: input.document_number || null,
    document_type: input.document_type,
    issuing_authority: input.issuing_authority || null,
    signer: input.signer || null,
    issue_date: input.issue_date || null,
    effective_date: input.effective_date || null,
    excerpt: input.excerpt || null,
    folder_id: input.folder_id || null,
    is_featured: input.is_featured,
    status: input.status,
  }

  let uploaded: { file_path: string; file_name: string; file_size: number; mime_type: string } | null = null
  if (file) {
    const problem = describeDocumentProblem(file)
    if (problem) throw new Error(problem)
    const ext = documentExtension(file.name)
    const mime = DOCUMENT_MIME_BY_EXT[ext]!
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`
    const { error } = await storage.upload(path, file, { contentType: mime, upsert: false })
    if (error) throw error
    uploaded = { file_path: path, file_name: file.name, file_size: file.size, mime_type: mime }
  }

  try {
    if (existing) {
      const { error } = await supabase
        .from('documents')
        .update({ ...row, ...uploaded })
        .eq('id', existing.id)
      if (error) throw error
      if (uploaded) await storage.remove([existing.file_path])
      return existing.id
    }
    if (!uploaded) throw new Error('Vui lòng chọn file văn bản.')
    const { data, error } = await supabase
      .from('documents')
      .insert({ ...row, ...uploaded, created_by: await requireUserId() })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  } catch (err) {
    if (uploaded) await storage.remove([uploaded.file_path])
    throw err
  }
}

export async function deleteDocument(doc: { id: string; file_path: string }): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path])
}

/** Chỉ văn bản đã ban hành (nhân sự đăng nhập đọc được cả bản nháp qua RLS). */
export async function fetchPublicDocuments(filter: DocumentFilter) {
  let query = getSupabase()
    .from('documents')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .order('issue_date', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .range(...pageRange(filter.page, DOCUMENT_PAGE_SIZE))
  if (filter.type) query = query.eq('document_type', filter.type)
  if (filter.folderIds?.length) query = query.in('folder_id', filter.folderIds)
  if (filter.query) {
    query = query.textSearch('search_vector', toSearchQuery(filter.query), {
      type: 'websearch',
      config: 'simple',
    })
  }
  const { data, error, count } = await query
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

export type PublicDocument = Awaited<ReturnType<typeof fetchPublicDocuments>>['items'][number]

export async function recordDownload(id: string): Promise<void> {
  await getSupabase().rpc('increment_document_download', { p_document_id: id })
}

export async function recordDocumentView(id: string): Promise<void> {
  await getSupabase().rpc('increment_document_view', { p_document_id: id })
}

/** Văn bản xem nhiều hoặc tải nhiều ở cột phải; chỉ văn bản có ít nhất một lượt. */
export async function fetchTopDocuments(by: 'view_count' | 'download_count', limit = 5) {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title, view_count, download_count')
    .eq('status', 'published')
    .gt(by, 0)
    .order(by, { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
