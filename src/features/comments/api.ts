import { pageRange } from '@/components/ui/page-utils'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const COMMENTS_KEY = ['comments'] as const
export const COMMENT_MAX_LENGTH = 2000
export const COMMENT_PAGE_SIZE = 20

export type CommentStatus = 'pending' | 'approved' | 'hidden'

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  hidden: 'Đã ẩn',
}

/** Bình luận đã duyệt của bài, kèm bình luận của chính người đang xem (RLS cho phép, kể cả đang chờ). */
export async function fetchNewsComments(newsId: string) {
  const { data, error } = await getSupabase()
    .from('news_comments')
    .select('id, parent_id, user_id, author_name, content, status, created_at')
    .eq('news_id', newsId)
    .order('created_at')
  if (error) throw error
  return data
}

/** user_id, tên và trạng thái do CSDL đặt, không nhận từ trình duyệt. */
export async function addComment(
  newsId: string,
  content: string,
  parentId: string | null = null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('news_comments')
    .insert({
      news_id: newsId,
      parent_id: parentId,
      content,
      author_name: '',
      user_id: await requireUserId(),
    })
  if (error) throw error
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await getSupabase().from('news_comments').delete().eq('id', id)
  if (error) throw error
}

export async function setCommentStatus(id: string, status: CommentStatus): Promise<void> {
  const { error } = await getSupabase().from('news_comments').update({ status }).eq('id', id)
  if (error) throw error
}

export async function fetchAdminComments(status: CommentStatus, page: number) {
  const { data, error, count } = await getSupabase()
    .from('news_comments')
    .select('id, parent_id, author_name, content, status, created_at, news:news(title, slug)', {
      count: 'exact',
    })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(...pageRange(page, COMMENT_PAGE_SIZE))
  if (error) throw error
  return { items: data, total: count ?? 0 }
}

/** Số lượt thích của các bình luận đã duyệt trong bài. */
export async function fetchCommentLikeCounts(newsId: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabase().rpc('news_comment_like_counts', { p_news: newsId })
  if (error) throw error
  return new Map(data.map((r) => [r.comment_id, Number(r.total)]))
}

/** Bình luận mà chính người đang xem đã thích (RLS chỉ trả lượt của mình). */
export async function fetchMyCommentLikes(commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set()
  const { data, error } = await getSupabase()
    .from('news_comment_likes')
    .select('comment_id')
    .in('comment_id', commentIds)
  if (error) throw error
  return new Set(data.map((r) => r.comment_id))
}

export async function setCommentLike(commentId: string, liked: boolean): Promise<void> {
  const supabase = getSupabase()
  const userId = await requireUserId()
  const { error } = liked
    ? await supabase.from('news_comment_likes').insert({ comment_id: commentId, user_id: userId })
    : await supabase.from('news_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
  if (error) throw error
}
