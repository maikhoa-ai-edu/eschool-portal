import { Link } from 'react-router'

export function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="mt-2 text-xl font-bold text-primary">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-muted">Đường dẫn không tồn tại hoặc đã được gỡ bỏ.</p>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-primary underline">
        Về trang chủ
      </Link>
    </main>
  )
}
