import { Zip, ZipPassThrough } from 'fflate'

/**
 * ZIP không nén (ảnh và PDF vốn đã nén): ghi dần ra Blob để trình duyệt không phải giữ cả file trong RAM,
 * và đọc bằng Blob.slice nên chỉ tải vào RAM file đang xử lý.
 */
export class ZipBuilder {
  private parts: Blob[] = []
  private zip = new Zip((error, chunk) => {
    if (error) throw error
    this.parts.push(new Blob([chunk as Uint8Array<ArrayBuffer>]))
  })

  add(name: string, data: Uint8Array): void {
    const entry = new ZipPassThrough(name)
    this.zip.add(entry)
    entry.push(data, true)
  }

  finish(): Blob {
    this.zip.end()
    return new Blob(this.parts, { type: 'application/zip' })
  }
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const EOCD_SIZE = 22
const MAX_COMMENT = 65535

async function viewOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer())
}

/** Đọc mục lục ZIP, trả về file theo tên dưới dạng Blob cắt từ file gốc. */
export async function readZipEntries(file: Blob): Promise<Map<string, Blob>> {
  const tailStart = Math.max(0, file.size - EOCD_SIZE - MAX_COMMENT)
  const tail = await viewOf(file.slice(tailStart))
  let eocd = -1
  for (let i = tail.byteLength - EOCD_SIZE; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('File không phải bản sao lưu (không đọc được ZIP).')

  const count = tail.getUint16(eocd + 10, true)
  const directorySize = tail.getUint32(eocd + 12, true)
  const directoryOffset = tail.getUint32(eocd + 16, true)
  const directory = await viewOf(file.slice(directoryOffset, directoryOffset + directorySize))
  const decoder = new TextDecoder()
  const entries = new Map<string, Blob>()

  let at = 0
  for (let n = 0; n < count; n++) {
    if (directory.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw new Error('File sao lưu bị hỏng.')
    }
    const method = directory.getUint16(at + 10, true)
    const size = directory.getUint32(at + 20, true)
    const nameLength = directory.getUint16(at + 28, true)
    const extraLength = directory.getUint16(at + 30, true)
    const commentLength = directory.getUint16(at + 32, true)
    const localOffset = directory.getUint32(at + 42, true)
    const name = decoder.decode(new Uint8Array(directory.buffer, directory.byteOffset + at + 46, nameLength))
    if (method !== 0)
      throw new Error('File sao lưu đã bị nén lại bằng công cụ khác. Hãy dùng đúng file đã tải về.')

    const local = await viewOf(file.slice(localOffset, localOffset + 30))
    const dataStart = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true)
    entries.set(name, file.slice(dataStart, dataStart + size))
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
