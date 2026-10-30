import { z } from 'zod'

export const MANIFEST_NAME = 'backup.json'
export const BACKUP_FORMAT = 'eschool-portal-backup'
export const BACKUP_FORMAT_VERSION = 1
const BUCKETS = ['media', 'documents']

const fileSchema = z.object({
  bucket: z.string(),
  path: z.string(),
  size: z.number(),
  mime_type: z.string().nullable().optional(),
})

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  format_version: z.number(),
  schema_version: z.string(),
  created_at: z.string(),
  source_url: z.string(),
  school_name: z.string(),
  files: z.array(fileSchema),
  missing_files: z.array(z.string()),
  data: z.record(z.string(), z.array(z.unknown())),
})

export type BackupFile = z.infer<typeof fileSchema>
export type BackupManifest = z.infer<typeof manifestSchema>

export function parseManifest(text: string): BackupManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('File này không phải bản sao lưu của eSchool Portal.')
  }
  const result = manifestSchema.safeParse(parsed)
  if (!result.success) throw new Error('File này không phải bản sao lưu của eSchool Portal.')
  if (result.data.format_version > BACKUP_FORMAT_VERSION) {
    throw new Error('Bản sao lưu được tạo từ phiên bản mới hơn. Hãy cập nhật website trước.')
  }
  return result.data
}

/** Ảnh chèn trong bài viết lưu địa chỉ đầy đủ, nên phải đổi sang project đang khôi phục. */
export function replaceStorageUrl(json: string, fromUrl: string, toUrl: string): string {
  const prefix = '/storage/v1/object/public/'
  return json.split(`${fromUrl}${prefix}`).join(`${toUrl}${prefix}`)
}

export function safeBackupPath({ bucket, path }: Pick<BackupFile, 'bucket' | 'path'>): boolean {
  return BUCKETS.includes(bucket) && !path.startsWith('/') && !path.split('/').includes('..')
}

export const fileEntryName = ({ bucket, path }: Pick<BackupFile, 'bucket' | 'path'>) =>
  `files/${bucket}/${path}`
