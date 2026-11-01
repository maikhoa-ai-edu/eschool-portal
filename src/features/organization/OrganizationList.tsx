import { useQuery } from '@tanstack/react-query'
import { ChevronDown, UsersRound } from 'lucide-react'
import { PublicQueryState } from '@/components/content/PublicPage'
import { EmptyState } from '@/components/ui/EmptyState'
import { resolveMediaUrl } from '@/features/media/api'
import { fetchOrganization, memberInitial, ORGANIZATION_KEY, type OrgMember } from './api'

export function MemberAvatar({ member }: { member: Pick<OrgMember, 'full_name' | 'avatar_path'> }) {
  const url = resolveMediaUrl(member.avatar_path)
  return url ? (
    <img src={url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary"
    >
      {memberInitial(member.full_name)}
    </span>
  )
}

function MemberTable({ members }: { members: OrgMember[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary/5 text-left">
              <th scope="col" className="w-16 p-2.5 font-semibold">
                Ảnh
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Họ tên
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Chức vụ
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Năm vào ngành
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Trình độ chuyên môn
              </th>
              <th scope="col" className="p-2.5 font-semibold">
                Môn phụ trách
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border align-middle">
                <td className="p-2.5">
                  <MemberAvatar member={m} />
                </td>
                <td className="p-2.5 font-semibold">{m.full_name}</td>
                <td className="p-2.5">{m.position}</td>
                <td className="p-2.5">{m.start_year}</td>
                <td className="p-2.5">{m.qualification}</td>
                <td className="p-2.5">{m.subjects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Điện thoại: thẻ thay cho bảng để không phải cuộn ngang */}
      <ul className="divide-y divide-border md:hidden">
        {members.map((m) => (
          <li key={m.id} className="flex gap-3 p-3">
            <MemberAvatar member={m} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{m.full_name}</p>
              {m.position && <p className="text-primary">{m.position}</p>}
              <dl className="mt-1 space-y-0.5 text-muted">
                {m.start_year && (
                  <div>
                    <dt className="inline">Năm vào ngành: </dt>
                    <dd className="inline text-text">{m.start_year}</dd>
                  </div>
                )}
                {m.qualification && (
                  <div>
                    <dt className="inline">Trình độ: </dt>
                    <dd className="inline text-text">{m.qualification}</dd>
                  </div>
                )}
                {m.subjects && (
                  <div>
                    <dt className="inline">Môn phụ trách: </dt>
                    <dd className="inline text-text">{m.subjects}</dd>
                  </div>
                )}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Mỗi bộ phận một dải bấm xổ xuống; bộ phận đầu tiên mở sẵn. Bộ phận chưa có ai đang hiện thì không hiện. */
export function OrganizationList() {
  const { data, isPending, error } = useQuery({
    queryKey: [...ORGANIZATION_KEY, 'public'],
    queryFn: () => fetchOrganization(true),
  })
  if (isPending || error) return <PublicQueryState isPending={isPending} error={error} />
  const units = data.filter((u) => u.org_members.length > 0)
  if (units.length === 0) return <EmptyState icon={UsersRound} title="Chưa có thông tin bộ phận" />
  return (
    <div className="mt-5 space-y-3">
      {units.map((unit, i) => (
        <details
          key={unit.id}
          open={i === 0}
          className="group overflow-hidden rounded-xl border-2 border-primary/20"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 bg-primary/5 p-4 hover:bg-primary/10 [&::-webkit-details-marker]:hidden">
            <UsersRound className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-primary">{unit.name}</span>
              {unit.description && <span className="block text-sm text-muted">{unit.description}</span>}
            </span>
            <span className="shrink-0 text-sm text-muted">{unit.org_members.length} người</span>
            <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden />
          </summary>
          <MemberTable members={unit.org_members} />
        </details>
      ))}
    </div>
  )
}
