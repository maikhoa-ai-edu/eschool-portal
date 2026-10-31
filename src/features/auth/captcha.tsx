import { useEffect, useRef, useState } from 'react'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<void> | null = null

/** Chỉ tải mã của Cloudflare khi trường đã bật, không ảnh hưởng tốc độ của trường không dùng. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Không tải được Turnstile'))
    }
    document.head.append(script)
  })
  return loading
}

export function CaptchaBox({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  /** Đổi giá trị để lấy mã mới: mỗi mã chỉ dùng được một lần */
  resetKey?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef(onToken)
  useEffect(() => {
    latest.current = onToken
  })

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (token) => latest.current(token),
          'expired-callback': () => latest.current(null),
          'error-callback': () => setFailed(true),
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      latest.current(null)
      window.turnstile?.reset(widget.current)
    }
  }, [resetKey])

  return (
    <div>
      <div ref={box} data-testid="captcha" />
      {failed && <p className="text-xs text-danger">Không tải được ô xác minh. Hãy tải lại trang.</p>}
    </div>
  )
}
