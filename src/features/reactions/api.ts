import { getSupabase, requireUserId } from '@/lib/supabase'
import { isReactionKey, type ReactionCounts, type ReactionKey } from './reactions'

export const REACTIONS_KEY = ['reactions'] as const

/** Số cảm xúc theo loại của nhiều bài cùng lúc. */
export async function fetchReactionCounts(newsIds: string[]): Promise<Map<string, ReactionCounts>> {
  const result = new Map<string, ReactionCounts>()
  if (newsIds.length === 0) return result
  const { data, error } = await getSupabase().rpc('news_reaction_counts', { p_news_ids: newsIds })
  if (error) throw error
  for (const row of data) {
    if (!isReactionKey(row.reaction)) continue
    result.set(row.news_id, { ...result.get(row.news_id), [row.reaction]: Number(row.total) })
  }
  return result
}

export async function fetchMyReaction(newsId: string): Promise<ReactionKey | null> {
  const { data, error } = await getSupabase()
    .from('news_reactions')
    .select('reaction')
    .eq('news_id', newsId)
    .maybeSingle()
  if (error) throw error
  return data && isReactionKey(data.reaction) ? data.reaction : null
}

/** Chọn, đổi hoặc bỏ (null) cảm xúc của chính mình. */
export async function setMyReaction(newsId: string, reaction: ReactionKey | null): Promise<void> {
  const supabase = getSupabase()
  const userId = await requireUserId()
  if (reaction === null) {
    const { error } = await supabase
      .from('news_reactions')
      .delete()
      .eq('news_id', newsId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('news_reactions')
    .upsert({ news_id: newsId, user_id: userId, reaction }, { onConflict: 'news_id,user_id' })
  if (error) throw error
}

/** Cuộc thi mà bài thuộc về (qua thẻ), để biết hạn bình chọn. */
export async function fetchContestForTags(tagSlugs: string[]) {
  if (tagSlugs.length === 0) return null
  const { data, error } = await getSupabase()
    .from('contests')
    .select('id, title, vote_ends_at, news_tags!inner(slug)')
    .in('news_tags.slug', tagSlugs)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}
