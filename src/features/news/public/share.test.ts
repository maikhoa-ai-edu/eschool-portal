import { describe, expect, it, vi } from 'vitest'
import { facebookShareUrl, shareForZalo } from './share'

const URL_BAI = 'https://truong.edu.vn/tin-tuc/bai-viet'

function env(share?: () => Promise<void>, writeText = vi.fn().mockResolvedValue(undefined)) {
  return { share, clipboard: { writeText } } as unknown as Pick<Navigator, 'share' | 'clipboard'>
}

describe('facebookShareUrl', () => {
  it('mã hóa địa chỉ bài viết', () => {
    expect(facebookShareUrl(`${URL_BAI}?a=1&b=2`)).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Ftruong.edu.vn%2Ftin-tuc%2Fbai-viet%3Fa%3D1%26b%3D2',
    )
  })
})

describe('shareForZalo', () => {
  it('điện thoại mở bảng chia sẻ của máy', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    await expect(shareForZalo(URL_BAI, 'Tiêu đề', env(share), true)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Tiêu đề', url: URL_BAI })
  })

  it('người dùng đóng bảng chia sẻ thì không chép liên kết', async () => {
    const writeText = vi.fn()
    const share = vi.fn().mockRejectedValue(new DOMException('đóng', 'AbortError'))
    await expect(shareForZalo(URL_BAI, 'T', env(share, writeText), true)).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('bảng chia sẻ lỗi thì chép liên kết', async () => {
    const share = vi.fn().mockRejectedValue(new Error('lỗi'))
    await expect(shareForZalo(URL_BAI, 'T', env(share), true)).resolves.toBe('copied')
  })

  it('máy tính chép liên kết dù trình duyệt có bảng chia sẻ', async () => {
    const share = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(shareForZalo(URL_BAI, 'T', env(share, writeText), false)).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(URL_BAI)
  })

  it('không chép được thì báo lỗi', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('chặn'))
    await expect(shareForZalo(URL_BAI, 'T', env(undefined, writeText), false)).resolves.toBe('failed')
  })
})
