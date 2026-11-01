import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { facebookShareUrl, shareForZalo, type ZaloShareResult } from './share'

const BUTTON = 'inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white hover:brightness-110'

const MESSAGES: Partial<Record<ZaloShareResult, string>> = {
  copied: 'Đã chép liên kết, hãy dán vào Zalo.',
  failed: 'Không chép được liên kết, hãy chép địa chỉ trên thanh trình duyệt.',
}

/** Liên kết thường, không tải script của Facebook hay Zalo. */
export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [message, setMessage] = useState('')
  const url = `${window.location.origin}${path}`

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Share2 className="h-4 w-4 text-muted" aria-hidden /> Chia sẻ:
      </span>
      <a
        href={facebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BUTTON} bg-[#166FE5]`}
      >
        Facebook
      </a>
      <button
        type="button"
        onClick={() => void shareForZalo(url, title).then((r) => setMessage(MESSAGES[r] ?? ''))}
        className={`${BUTTON} bg-[#0068FF]`}
      >
        Zalo
      </button>
      <span role="status" className="text-sm text-muted">
        {message}
      </span>
    </div>
  )
}
