import { queryOptions } from '@tanstack/react-query'
import { fetchDepartments } from '@/lib/api'
import type { Meta, SemesterPath } from '@/types/api'

/** 學院 / 系所 / 班級三層對照。搜尋頁與詳情頁共用同一份快取。 */
export function departmentsQueryOptions(meta: Meta, semester: SemesterPath) {
  const version =
    meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'

  return queryOptions({
    queryKey: ['departments', semester, version],
    queryFn: () => fetchDepartments(meta, semester),
    staleTime: Infinity,
  })
}
