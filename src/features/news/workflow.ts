import type { BadgeTone } from '@/components/ui/Badge'

export const NEWS_STATUSES = ['draft', 'pending', 'published', 'archived'] as const
export type NewsStatus = (typeof NEWS_STATUSES)[number]

export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  published: 'Đã đăng',
  archived: 'Đã gỡ',
}

export const NEWS_STATUS_TONES: Record<NewsStatus, BadgeTone> = {
  draft: 'neutral',
  pending: 'warning',
  published: 'success',
  archived: 'danger',
}

export function isNewsStatus(value: unknown): value is NewsStatus {
  return typeof value === 'string' && (NEWS_STATUSES as readonly string[]).includes(value)
}

/**
 * Thao tác trên trang soạn bài. CSDL (RLS + trigger news_workflow) mới là nơi quyết định;
 * hàm này chỉ chọn nút nào hiện ra để người dùng không bấm vào thao tác chắc chắn bị từ chối.
 */
export type NewsAction = 'save_draft' | 'submit' | 'withdraw' | 'save' | 'publish' | 'reject' | 'unpublish'

export interface NewsPermissions {
  canPublish: boolean
  canEditAny: boolean
  isAuthor: boolean
}

export interface NewsWorkflowView {
  /** Người dùng sửa được nội dung bài */
  editable: boolean
  actions: NewsAction[]
}

export function newsWorkflow(status: NewsStatus | null, perms: NewsPermissions): NewsWorkflowView {
  const { canPublish, canEditAny, isAuthor } = perms
  if (status === null) {
    return { editable: true, actions: canPublish ? ['save_draft', 'publish'] : ['save_draft', 'submit'] }
  }
  const ownsOrManages = canEditAny || isAuthor
  switch (status) {
    case 'draft':
      if (!ownsOrManages) return { editable: false, actions: [] }
      return { editable: true, actions: canPublish ? ['save_draft', 'publish'] : ['save_draft', 'submit'] }
    case 'pending':
      if (!ownsOrManages) return { editable: false, actions: [] }
      return { editable: true, actions: canPublish ? ['save', 'reject', 'publish'] : ['save', 'withdraw'] }
    case 'published':
      if (!canEditAny) return { editable: false, actions: [] }
      return { editable: true, actions: canPublish ? ['save', 'unpublish'] : ['save'] }
    case 'archived':
      if (!canEditAny) return { editable: false, actions: [] }
      return { editable: true, actions: canPublish ? ['save', 'publish'] : ['save'] }
  }
}

/** Trạng thái sau khi thực hiện thao tác. */
export function targetStatus(action: NewsAction, current: NewsStatus | null): NewsStatus {
  switch (action) {
    case 'save_draft':
    case 'withdraw':
    case 'reject':
      return 'draft'
    case 'submit':
      return 'pending'
    case 'publish':
      return 'published'
    case 'unpublish':
      return 'archived'
    case 'save':
      return current ?? 'draft'
  }
}

export function actionLabel(action: NewsAction, current: NewsStatus | null): string {
  switch (action) {
    case 'save_draft':
      return 'Lưu nháp'
    case 'submit':
      return 'Gửi duyệt'
    case 'withdraw':
      return 'Rút về nháp'
    case 'save':
      return 'Lưu thay đổi'
    case 'publish':
      return current === 'pending' ? 'Duyệt & đăng' : current === 'archived' ? 'Đăng lại' : 'Đăng ngay'
    case 'reject':
      return 'Trả lại tác giả'
    case 'unpublish':
      return 'Gỡ bài'
  }
}

/** Câu báo sau khi thao tác thành công. */
export function actionDoneMessage(action: NewsAction): string {
  switch (action) {
    case 'submit':
      return 'Đã gửi bài cho quản trị viên duyệt.'
    case 'publish':
      return 'Bài viết đã được đăng.'
    case 'reject':
      return 'Đã trả bài lại cho tác giả kèm góp ý.'
    case 'unpublish':
      return 'Đã gỡ bài khỏi trang công khai.'
    case 'withdraw':
      return 'Đã rút bài về nháp.'
    default:
      return 'Đã lưu.'
  }
}

/** Chuỗi "a, b, c" -> danh sách thẻ không trùng (so sánh không phân biệt hoa thường). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of input.split(',')) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    const key = tag.toLocaleLowerCase('vi')
    if (tag && !seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
}
