import { getSupabase, requireUserId } from '@/lib/supabase'

export const MEDIA_BUCKET = 'media'
export const DOCUMENTS_BUCKET = 'documents'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
/** Khớp file_size_limit của bucket media (migration media) */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
/** Ảnh lớn hơn cạnh này được thu nhỏ trước khi tải lên (ảnh chụp điện thoại thường 4000px) */
const MAX_IMAGE_DIMENSION = 1920

export function publicFileUrl(bucket: string, path: string, download?: string): string {
  return getSupabase()
    .storage.from(bucket)
    .getPublicUrl(path, download ? { download } : undefined).data.publicUrl
}

/**
 * Ảnh lưu trong CSDL là đường dẫn trong bucket media (vd seed/logo.jpg) để dữ liệu không phụ thuộc địa chỉ
 * project; giá trị cũ là địa chỉ đầy đủ (http/https, data:, /...) vẫn dùng nguyên.
 */
export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value
  return publicFileUrl(MEDIA_BUCKET, value)
}

export function describeImageProblem(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.'
  if (file.size > IMAGE_MAX_BYTES) return 'Ảnh quá lớn (tối đa 10 MB).'
  return null
}

export function fileExtension(type: string): string {
  return type.split('/')[1]!.replace('jpeg', 'jpg')
}

/** Tên file bỏ phần mở rộng, dùng làm tiêu đề mặc định của ảnh. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Ảnh'
}

/** Kích thước sau khi thu nhỏ giữ nguyên tỉ lệ để cạnh dài nhất không quá max. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

interface PreparedImage {
  blob: Blob
  type: string
  width: number | null
  height: number | null
}

/** Thu nhỏ ảnh quá lớn (trừ GIF động); trình duyệt không đọc được ảnh thì tải nguyên bản. */
async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { blob: file, type: file.type, width: null, height: null }
  }
  const original = { width: bitmap.width, height: bitmap.height }
  const target = fitWithin(original.width, original.height, MAX_IMAGE_DIMENSION)
  const needsResize = target.width < original.width || file.size > 2 * 1024 * 1024
  if (file.type === 'image/gif' || !needsResize) {
    bitmap.close()
    return { blob: file, type: file.type, ...original }
  }

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, target.width, target.height)
  bitmap.close()
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, 0.85))
  // Bản thu nhỏ không nhẹ hơn (ảnh đã nén kỹ) thì giữ bản gốc
  if (!blob || blob.size >= file.size) return { blob: file, type: file.type, ...original }
  return { blob, type: outType, ...target }
}

export interface UploadedImage {
  id: string
  url: string
  path: string
}

/**
 * Tải ảnh vào bucket media (tên file ngẫu nhiên trong thư mục `folder`) và ghi vào thư viện media.
 * Lỗi ở bước ghi CSDL thì xóa file vừa tải để không để lại rác.
 */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  const problem = describeImageProblem(file)
  if (problem) throw new Error(problem)
  const supabase = getSupabase()
  const userId = await requireUserId()
  const image = await prepareImage(file)
  const path = `${folder}/${crypto.randomUUID()}.${fileExtension(image.type)}`

  const storage = supabase.storage.from(MEDIA_BUCKET)
  const upload = await storage.upload(path, image.blob, { contentType: image.type, upsert: false })
  if (upload.error) throw upload.error

  const { data, error } = await supabase
    .from('media')
    .insert({
      title: baseName(file.name),
      file_path: path,
      file_size: image.blob.size,
      mime_type: image.type,
      width: image.width,
      height: image.height,
      created_by: userId,
    })
    .select('id')
    .single()
  if (error) {
    await storage.remove([path])
    throw error
  }
  return { id: data.id, url: publicFileUrl(MEDIA_BUCKET, path), path }
}

/** Xóa ảnh khỏi thư viện (album_items liên quan tự xóa theo) rồi xóa file. */
export async function deleteMedia(media: { id: string; file_path: string }): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('media').delete().eq('id', media.id)
  if (error) throw error
  await supabase.storage.from(MEDIA_BUCKET).remove([media.file_path])
}
