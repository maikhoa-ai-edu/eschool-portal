import { pageRange } from '@/components/ui/page-utils'
import { MEDIA_BUCKET, publicFileUrl, uploadImage } from '@/features/media/api'
import { withRandomSuffix } from '@/lib/slug'
import { getSupabase, requireUserId } from '@/lib/supabase'

export const ALBUMS_KEY = ['albums'] as const
export const ALBUM_PAGE_SIZE = 12

export function mediaUrl(path: string): string {
  return publicFileUrl(MEDIA_BUCKET, path)
}

const CARD_COLUMNS =
  'id, title, slug, description, event_date, status, published_at, updated_at, cover:media!albums_cover_media_id_fkey(file_path), album_items(count)'

function toCard<T extends { cover: { file_path: string } | null; album_items: Array<{ count: number }> }>(
  row: T,
) {
  const { cover, album_items, ...rest } = row
  return {
    ...rest,
    coverUrl: cover ? mediaUrl(cover.file_path) : null,
    imageCount: album_items[0]?.count ?? 0,
  }
}

export async function fetchAdminAlbums() {
  const { data, error } = await getSupabase()
    .from('albums')
    .select(CARD_COLUMNS)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(toCard)
}

export type AlbumCard = Awaited<ReturnType<typeof fetchAdminAlbums>>[number]

const DETAIL_COLUMNS =
  'id, title, slug, description, event_date, status, cover_media_id, album_items(media_id, sort_order, caption, media(id, file_path, title, width, height))'

export interface AlbumImage {
  mediaId: string
  path: string
  url: string
  title: string
  caption: string | null
  sortOrder: number
  width: number | null
  height: number | null
}

async function fetchAlbumBy(column: 'id' | 'slug', value: string) {
  const { data, error } = await getSupabase()
    .from('albums')
    .select(DETAIL_COLUMNS)
    .eq(column, value)
    .order('sort_order', { referencedTable: 'album_items' })
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { album_items, ...album } = data
  const images: AlbumImage[] = album_items
    .filter((item) => item.media)
    .map((item) => ({
      mediaId: item.media_id,
      path: item.media!.file_path,
      url: mediaUrl(item.media!.file_path),
      title: item.media!.title,
      caption: item.caption,
      sortOrder: item.sort_order,
      width: item.media!.width,
      height: item.media!.height,
    }))
  return { ...album, images }
}

export const fetchAlbum = (id: string) => fetchAlbumBy('id', id)
export type AlbumDetail = NonNullable<Awaited<ReturnType<typeof fetchAlbum>>>

export interface AlbumInput {
  title: string
  slug: string
  description: string
  event_date: string
  status: 'draft' | 'published'
}

export async function saveAlbum(input: AlbumInput, id?: string): Promise<string> {
  const supabase = getSupabase()
  const row = { ...input, description: input.description || null, event_date: input.event_date || null }
  if (id) {
    const { error } = await supabase.from('albums').update(row).eq('id', id)
    if (error) throw error
    return id
  }
  const created_by = await requireUserId()
  let result = await supabase
    .from('albums')
    .insert({ ...row, created_by })
    .select('id')
    .single()
  if (result.error?.code === '23505') {
    result = await supabase
      .from('albums')
      .insert({ ...row, slug: withRandomSuffix(row.slug), created_by })
      .select('id')
      .single()
  }
  if (result.error) throw result.error
  return result.data.id
}

/** Xóa album cùng toàn bộ ảnh của album (bản ghi media và file). */
export async function deleteAlbum(album: AlbumDetail): Promise<void> {
  const supabase = getSupabase()
  const mediaIds = album.images.map((i) => i.mediaId)
  if (mediaIds.length > 0) {
    const { error } = await supabase.from('media').delete().in('id', mediaIds)
    if (error) throw error
    await supabase.storage.from(MEDIA_BUCKET).remove(album.images.map((i) => i.path))
  }
  const { error } = await supabase.from('albums').delete().eq('id', album.id)
  if (error) throw error
}

/** Tải lần lượt từng ảnh vào album; ảnh đầu tiên làm ảnh bìa nếu album chưa có. */
export async function addImages(
  album: AlbumDetail,
  files: File[],
  onProgress: (done: number) => void,
): Promise<string[]> {
  const supabase = getSupabase()
  const errors: string[] = []
  let order = album.images.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1
  let cover = album.cover_media_id
  for (const [index, file] of files.entries()) {
    try {
      const image = await uploadImage(file, `albums/${album.id}`)
      const { error } = await supabase
        .from('album_items')
        .insert({ album_id: album.id, media_id: image.id, sort_order: order++ })
      if (error) throw error
      if (!cover) {
        cover = image.id
        const res = await supabase.from('albums').update({ cover_media_id: cover }).eq('id', album.id)
        if (res.error) throw res.error
      }
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
    onProgress(index + 1)
  }
  return errors
}

/** Xóa ảnh khỏi album (ảnh của album không dùng ở nơi khác nên xóa luôn file). */
export async function removeImage(image: AlbumImage): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('media').delete().eq('id', image.mediaId)
  if (error) throw error
  await supabase.storage.from(MEDIA_BUCKET).remove([image.path])
}

export async function setCover(albumId: string, mediaId: string): Promise<void> {
  const { error } = await getSupabase().from('albums').update({ cover_media_id: mediaId }).eq('id', albumId)
  if (error) throw error
}

export async function updateCaption(albumId: string, mediaId: string, caption: string): Promise<void> {
  const { error } = await getSupabase()
    .from('album_items')
    .update({ caption: caption.trim() || null })
    .eq('album_id', albumId)
    .eq('media_id', mediaId)
  if (error) throw error
}

/** Đổi chỗ hai ảnh liền kề; đánh lại số thứ tự 0..n để không bị trùng. */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

export async function saveOrder(albumId: string, images: AlbumImage[]): Promise<void> {
  const supabase = getSupabase()
  const changed = images
    .map((img, index) => ({ img, index }))
    .filter(({ img, index }) => img.sortOrder !== index)
  for (const { img, index } of changed) {
    const { error } = await supabase
      .from('album_items')
      .update({ sort_order: index })
      .eq('album_id', albumId)
      .eq('media_id', img.mediaId)
    if (error) throw error
  }
}

/** Album đã đăng (lọc tường minh vì nhân sự đọc được cả album nháp). */
export async function fetchPublicAlbums(page: number) {
  const { data, error, count } = await getSupabase()
    .from('albums')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .range(...pageRange(page, ALBUM_PAGE_SIZE))
  if (error) throw error
  return { items: data.map(toCard), total: count ?? 0 }
}

export const fetchPublicAlbum = (slug: string) => fetchAlbumBy('slug', slug)
