import { useMemo } from 'react'
import { sanitizeHtml } from '@/lib/sanitize'
import { cn } from '@/lib/cn'

/** Hiển thị nội dung HTML do nhân sự soạn; luôn qua DOMPurify trước khi đưa vào trang. */
export function RichContent({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return <div className={cn('rich-content', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}
