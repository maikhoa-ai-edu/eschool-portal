import type { ReactNode } from 'react'
import { SchoolLogo } from '@/components/SchoolLogo'
import { useSite } from '@/features/site/site-context'

/** Khung chung của các trang đăng ký và lấy lại mật khẩu. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const { identity } = useSite()
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <SchoolLogo className="h-16 w-16" />
          <h1 className="mt-3 text-lg font-bold text-primary">{title}</h1>
          <p className="text-sm text-muted">{identity.school_name}</p>
        </div>
        {children}
      </div>
    </main>
  )
}
