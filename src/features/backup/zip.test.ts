// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareVersions } from '@/lib/semver'
import { parseManifest, replaceStorageUrl, safeBackupPath } from './manifest'
import { readZipEntries, ZipBuilder } from './zip'

describe('ZIP sao lưu', () => {
  it('ghi rồi đọc lại đúng nội dung, cả tên tiếng Việt', async () => {
    const zip = new ZipBuilder()
    const text = new TextEncoder().encode('{"a":1}')
    const binary = new Uint8Array(70_000).map((_, i) => i % 251)
    zip.add('backup.json', text)
    zip.add('files/media/ảnh mới.jpg', binary)
    const entries = await readZipEntries(zip.finish())
    expect([...entries.keys()]).toEqual(['backup.json', 'files/media/ảnh mới.jpg'])
    expect(await entries.get('backup.json')!.text()).toBe('{"a":1}')
    expect(new Uint8Array(await entries.get('files/media/ảnh mới.jpg')!.arrayBuffer())).toEqual(binary)
  })

  it('từ chối file không phải ZIP', async () => {
    await expect(readZipEntries(new Blob(['không phải zip']))).rejects.toThrow(/không đọc được ZIP/)
  })
})

describe('nội dung bản sao lưu', () => {
  const valid = {
    format: 'eschool-portal-backup',
    format_version: 1,
    schema_version: '0.7.0',
    created_at: '2026-10-30T00:00:00Z',
    source_url: 'https://a.supabase.co',
    school_name: 'Trường A',
    files: [{ bucket: 'media', path: 'seed/logo.jpg', size: 10, mime_type: 'image/jpeg' }],
    missing_files: [],
    data: { news: [], profiles: [] },
  }

  it('nhận file đúng định dạng, từ chối file khác', () => {
    expect(parseManifest(JSON.stringify(valid)).school_name).toBe('Trường A')
    expect(() => parseManifest('{"format":"khac"}')).toThrow(/không phải bản sao lưu/)
    expect(() => parseManifest('không phải json')).toThrow(/không phải bản sao lưu/)
    expect(() => parseManifest(JSON.stringify({ ...valid, format_version: 99 }))).toThrow(/phiên bản mới hơn/)
  })

  it('đổi địa chỉ file trong nội dung bài viết sang project mới', () => {
    const json = '{"content":"<img src=\\"https://a.supabase.co/storage/v1/object/public/media/x.jpg\\">"}'
    expect(replaceStorageUrl(json, 'https://a.supabase.co', 'https://b.supabase.co')).toBe(
      '{"content":"<img src=\\"https://b.supabase.co/storage/v1/object/public/media/x.jpg\\">"}',
    )
  })

  it('chỉ nhận đường dẫn file an toàn', () => {
    expect(safeBackupPath({ bucket: 'media', path: 'seed/album/a.jpg' })).toBe(true)
    expect(safeBackupPath({ bucket: 'media', path: '../a.jpg' })).toBe(false)
    expect(safeBackupPath({ bucket: 'media', path: '/a.jpg' })).toBe(false)
    expect(safeBackupPath({ bucket: 'bi-mat', path: 'a.jpg' })).toBe(false)
  })
})

describe('so sánh phiên bản', () => {
  it('so theo số, không theo chữ', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('0.6.0', '0.7.0')).toBeLessThan(0)
  })
})
