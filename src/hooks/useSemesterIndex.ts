import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { fetchSemesterIndex } from '@/lib/api'
import type { Meta, SemesterPath } from '@/types/api'

/**
 * 單一學期的輕量索引。gzip 約 83 KB,一次載完就能在前端搜尋全學期。
 *
 * query key 帶上該學期的 `generated_at`:crawler 更新後 key 會變,
 * TanStack Query 自然重取,不必自己做失效邏輯。
 */
export function semesterIndexQueryOptions(meta: Meta, semester: SemesterPath) {
  const version =
    meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'

  return queryOptions({
    queryKey: ['semester-index', semester, version],
    queryFn: () => fetchSemesterIndex(meta, semester),
    staleTime: Infinity,
  })
}

export function useSemesterIndex(meta: Meta, semester: SemesterPath) {
  return useSuspenseQuery(semesterIndexQueryOptions(meta, semester)).data
}
