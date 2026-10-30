import type { Json } from '@/lib/database.types'
import { getSupabase } from '@/lib/supabase'
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  fileEntryName,
  MANIFEST_NAME,
  parseManifest,
  replaceStorageUrl,
  safeBackupPath,
  type BackupFile,
  type BackupManifest,
} from './manifest'
import { readZipEntries, ZipBuilder } from './zip'

export type Progress = (done: number, total: number) => void

interface ExportedBackup {
  schema_version: string
  created_at: string
  data: Record<string, unknown[]>
  files: BackupFile[]
}

export interface CreatedBackup {
  blob: Blob
  fileName: string
  fileCount: number
  missing: string[]
}

export async function createBackup(
  options: { includeFiles: boolean; schoolName: string; sourceUrl: string },
  onProgress: Progress,
): Promise<CreatedBackup> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('export_backup')
  if (error) throw error
  const exported = data as unknown as ExportedBackup

  const zip = new ZipBuilder()
  const files = options.includeFiles ? exported.files : []
  const included: BackupFile[] = []
  const missing: string[] = []
  // File tải về trước để mục lục ghi đúng những gì thật sự có trong bản sao lưu
  for (const [index, file] of files.entries()) {
    onProgress(index, files.length)
    try {
      const url = supabase.storage.from(file.bucket).getPublicUrl(file.path).data.publicUrl
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      zip.add(fileEntryName(file), new Uint8Array(await res.arrayBuffer()))
      included.push(file)
    } catch {
      missing.push(`${file.bucket}/${file.path}`)
    }
  }
  onProgress(files.length, files.length)

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    schema_version: exported.schema_version,
    created_at: exported.created_at,
    source_url: options.sourceUrl,
    school_name: options.schoolName,
    files: included,
    missing_files: missing,
    data: exported.data,
  }
  zip.add(MANIFEST_NAME, new TextEncoder().encode(JSON.stringify(manifest)))

  const date = exported.created_at.slice(0, 10)
  return { blob: zip.finish(), fileName: `sao-luu-${date}.zip`, fileCount: included.length, missing }
}

export interface OpenedBackup {
  manifest: BackupManifest
  /** Nội dung gốc của backup.json, giữ nguyên để không phải JSON hóa lại khi khôi phục */
  rawManifest: string
  entries: Map<string, Blob>
}

export async function openBackup(file: File): Promise<OpenedBackup> {
  const entries = await readZipEntries(file)
  const entry = entries.get(MANIFEST_NAME)
  if (!entry) throw new Error('File này không phải bản sao lưu của eSchool Portal.')
  const rawManifest = await entry.text()
  return { manifest: parseManifest(rawManifest), rawManifest, entries }
}

/** Tải file lên trước, dữ liệu sau: tải lỗi giữa chừng thì dữ liệu trên website chưa bị thay đổi. */
export async function restoreBackup(
  { manifest, rawManifest, entries }: OpenedBackup,
  targetUrl: string,
  onProgress: Progress,
): Promise<Record<string, number>> {
  const supabase = getSupabase()
  for (const [index, file] of manifest.files.entries()) {
    onProgress(index, manifest.files.length)
    const blob = entries.get(fileEntryName(file))
    if (!blob || !safeBackupPath(file))
      throw new Error(`File sao lưu thiếu hoặc sai: ${file.bucket}/${file.path}`)
    // Với Blob, Supabase lấy loại file từ chính Blob (bỏ qua contentType), nên phải gắn loại vào đây
    const typed = blob.slice(0, blob.size, file.mime_type ?? '')
    const { error } = await supabase.storage.from(file.bucket).upload(file.path, typed, {
      upsert: true,
      contentType: file.mime_type ?? undefined,
    })
    if (error) throw new Error(`Không tải lên được ${file.path}: ${error.message}`)
  }
  onProgress(manifest.files.length, manifest.files.length)

  const payload = JSON.parse(replaceStorageUrl(rawManifest, manifest.source_url, targetUrl)) as Json
  const { data, error } = await supabase.rpc('restore_backup', { p_backup: payload })
  if (error) throw error
  return data as Record<string, number>
}
