import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeroSlider } from './HeroSlider'
import type { Slide } from './api'

vi.mock('./api', () => ({ slideImageUrl: (slide: { image_path: string }) => slide.image_path }))
vi.mock('@/features/media/api', () => ({ responsiveImage: () => ({}) }))

const slides = ['a', 'b', 'c', 'd'].map(
  (id) => ({ id, title: id, subtitle: null, image_path: `${id}.jpg`, link_url: null }) as Slide,
)

function sources(container: HTMLElement) {
  return [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
}

function setup() {
  return render(
    <MemoryRouter>
      <HeroSlider slides={slides} interval={6} />
    </MemoryRouter>,
  ).container
}

describe('HeroSlider tải ảnh', () => {
  afterEach(cleanup)

  it('ban đầu chỉ tải ảnh đầu tiên', () => {
    expect(sources(setup())).toEqual(['a.jpg'])
  })

  it('ảnh đang hiện tải xong thì tải trước đúng một ảnh kế tiếp', () => {
    const container = setup()
    fireEvent.load(container.querySelector('img')!)
    expect(sources(container)).toEqual(['a.jpg', 'b.jpg'])
    // Ảnh kế tiếp đang ẩn: tải xong không kéo theo ảnh sau nữa
    fireEvent.load(container.querySelectorAll('img')[1]!)
    expect(sources(container)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('bấm chuyển tới ảnh chưa tải thì tải ảnh đó, ảnh đã tải vẫn giữ', () => {
    const container = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển tới ảnh 4' }))
    expect(sources(container)).toEqual(['a.jpg', 'd.jpg'])
  })
})
