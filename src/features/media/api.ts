import { getSupabase, requireUserId } from '@/lib/supabase'

export const MEDIA_BUCKET = 'media'
export const DOCUMENTS_BUCKET = 'documents'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
/** Khớp file_size_limit của bucket media (migration media) */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
/** Ảnh lớn hơn cạnh này được thu nhỏ trước khi tải lên (ảnh chụp điện thoại thường 4000px) */
const MAX_IMAGE_DIMENSION = 1920

/**
 * Gói miễn phí của Supabase không đổi kích thước ảnh, nên bản nhỏ được tạo sẵn lúc tải lên, nằm cạnh ảnh gốc:
 *   slides/abc-rsw.jpg -> slides/abc-rsw.w480.webp, .w960.webp, .w1600.webp
 * Đuôi tên -rsw (webp) hoặc -rsj (jpeg, trình duyệt không mã hóa được webp) nghĩa là có đủ bản nhỏ; ảnh cũ không có
 * đuôi này chỉ dùng ảnh gốc, nên không phát sinh yêu cầu lỗi 404.
 */
export const IMAGE_WIDTHS = [480, 960, 1600] as const
const VARIANT_MARK = /-rs([wj])\.[a-z]+$/i

function variantUrl(url: string, width: number): string | null {
  const mark = VARIANT_MARK.exec(url)
  if (!mark) return null
  const extension = mark[1]!.toLowerCase() === 'w' ? 'webp' : 'jpg'
  return url.replace(/\.[a-z]+$/i, `.w${width}.${extension}`)
}

/** Thuộc tính srcSet + sizes cho thẻ img. Ảnh không có bản nhỏ thì không thêm gì. */
export function responsiveImage(
  value: string | null | undefined,
  sizes: string,
): { srcSet?: string; sizes?: string } {
  const url = resolveMediaUrl(value)
  if (!url || !VARIANT_MARK.test(url)) return {}
  return { srcSet: IMAGE_WIDTHS.map((w) => `${variantUrl(url, w)} ${w}w`).join(', '), sizes }
}

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

function encodeVariant(bitmap: ImageBitmap, width: number, type: string): Promise<Blob | null> {
  const size = fitWithin(bitmap.width, bitmap.height, width)
  // Chỉ giới hạn theo chiều ngang: ảnh dọc vẫn đủ nét khi hiện theo chiều rộng khung
  const scale = Math.min(1, width / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale) || size.width
  canvas.height = Math.round(bitmap.height * scale) || size.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.75))
}

/**
 * Tải các bản nhỏ của ảnh. Không tạo được (GIF, trình duyệt không đọc được ảnh, lỗi mạng) thì trả về null:
 * ảnh vẫn tải lên bình thường, chỉ dùng bản gốc.
 */
async function uploadVariants(file: File, base: string): Promise<{ mark: string; paths: string[] } | null> {
  if (file.type === 'image/gif') return null
  const storage = getSupabase().storage.from(MEDIA_BUCKET)
  const paths: string[] = []
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    // Trình duyệt không hỗ trợ mã hóa webp sẽ trả về png: khi đó dùng jpeg
    const probe = await encodeVariant(bitmap, IMAGE_WIDTHS[0], 'image/webp')
    const useWebp = probe?.type === 'image/webp'
    const type = useWebp ? 'image/webp' : 'image/jpeg'
    const mark = useWebp ? '-rsw' : '-rsj'
    for (const width of IMAGE_WIDTHS) {
      const blob = await encodeVariant(bitmap, width, type)
      if (!blob) throw new Error('Không tạo được ảnh thu nhỏ')
      const path = `${base}${mark}.w${width}.${useWebp ? 'webp' : 'jpg'}`
      const { error } = await storage.upload(path, blob, { contentType: type, upsert: false })
      if (error) throw error
      paths.push(path)
    }
    return { mark, paths }
  } catch {
    if (paths.length > 0) await storage.remove(paths)
    return null
  } finally {
    bitmap?.close()
  }
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
  const storage = supabase.storage.from(MEDIA_BUCKET)
  const id = crypto.randomUUID()
  const uploadedVariants = await uploadVariants(file, `${folder}/${id}`)
  const mark = uploadedVariants ? uploadedVariants.mark : ''
  const path = `${folder}/${id}${mark}.${fileExtension(image.type)}`

  const upload = await storage.upload(path, image.blob, { contentType: image.type, upsert: false })
  if (upload.error) {
    if (uploadedVariants) await storage.remove(uploadedVariants.paths)
    throw upload.error
  }

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
    await storage.remove([path, ...(uploadedVariants?.paths ?? [])])
    throw error
  }
  return { id: data.id, url: publicFileUrl(MEDIA_BUCKET, path), path }
}

/** Xóa ảnh khỏi thư viện (album_items liên quan tự xóa theo) rồi xóa file. */
export async function deleteMedia(media: { id: string; file_path: string }): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('media').delete().eq('id', media.id)
  if (error) throw error
  const variants = IMAGE_WIDTHS.map((w) => variantUrl(media.file_path, w)).filter((p) => p !== null)
  await supabase.storage.from(MEDIA_BUCKET).remove([media.file_path, ...variants])
}
