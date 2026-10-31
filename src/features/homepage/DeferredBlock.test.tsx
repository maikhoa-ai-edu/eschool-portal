import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeferredBlock } from './DeferredBlock'

let intersect: (isIntersecting: boolean) => void

class FakeObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    intersect = (isIntersecting) => callback([{ isIntersecting }])
  }
  observe() {}
  disconnect() {}
}

describe('DeferredBlock', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('trình duyệt không có IntersectionObserver thì dựng ngay', () => {
    render(<DeferredBlock>Nội dung</DeferredBlock>)
    expect(screen.getByText('Nội dung')).toBeInTheDocument()
  })

  describe('có IntersectionObserver', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.stubGlobal('IntersectionObserver', FakeObserver)
    })

    it('chưa dựng khi còn xa màn hình, dựng khi tới gần', () => {
      render(<DeferredBlock>Nội dung</DeferredBlock>)
      expect(screen.queryByText('Nội dung')).not.toBeInTheDocument()
      act(() => intersect(false))
      expect(screen.queryByText('Nội dung')).not.toBeInTheDocument()
      act(() => intersect(true))
      expect(screen.getByText('Nội dung')).toBeInTheDocument()
    })

    it('tự dựng sau một lúc, kể cả khi chưa cuộn tới', () => {
      render(<DeferredBlock>Nội dung</DeferredBlock>)
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByText('Nội dung')).toBeInTheDocument()
    })

    it('dựng ngay khi người dùng bấm phím, để Tab không nhảy qua khối', () => {
      render(<DeferredBlock>Nội dung</DeferredBlock>)
      fireEvent.keyDown(window, { key: 'Tab' })
      expect(screen.getByText('Nội dung')).toBeInTheDocument()
    })

    it('sau khi dựng không còn thẻ bọc', () => {
      const { container } = render(
        <DeferredBlock>
          <section>Nội dung</section>
        </DeferredBlock>,
      )
      act(() => intersect(true))
      expect(container.firstElementChild?.tagName).toBe('SECTION')
    })
  })
})
