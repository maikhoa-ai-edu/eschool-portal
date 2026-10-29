import { isRouteErrorResponse, useRouteError } from 'react-router'

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Lỗi không xác định'

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-primary">Đã xảy ra lỗi</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <a href="/" className="mt-6 inline-block text-sm font-semibold text-primary underline">
        Về trang chủ
      </a>
    </main>
  )
}
