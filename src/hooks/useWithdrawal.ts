import { queryOptions, useQueries } from '@tanstack/react-query'

import { fetchSemesterIndex } from '@/lib/api'
import { mergeSummaries, summarizeSemester } from '@/lib/withdrawal'
import type { MergedWithdrawal } from '@/lib/withdrawal'
import type { Meta, SemesterPath } from '@/types/api'

export const RANGES = ['sem', 'y3', 'y5', 'all'] as const
export type Range = (typeof RANGES)[number]

export const RANGE_LABELS: Record<Range, string> = {
  sem: '這個學期',
  y3: '過去三年',
  y5: '過去五年',
  all: '所有期間',
}

/** 一學年兩個學期,所以三年 = 6 個。`all` 由 meta 決定,現在是 51 個。 */
const RANGE_SIZE: Record<Range, number> = { sem: 1, y3: 6, y5: 10, all: Infinity }

/**
 * 從選定的學期往回數。
 *
 * 往**回**數而不是永遠從最新的算起:選了 113-1 + 過去三年,拿到的就是
 * 113-1 到 111-2,而不是包含 113-1 之後的學期。
 */
export function rangeSemesters(
  meta: Meta,
  semester: SemesterPath,
  range: Range,
): SemesterPath[] {
  const order = meta.semesters.map((s) => s.path)
  const start = Math.max(0, order.indexOf(semester))
  return order.slice(start, start + RANGE_SIZE[range])
}

/**
 * 單一學期的退選統計。
 *
 * **回傳的是壓縮後的摘要,不是整份索引。** 索引解析出來一個學期就好幾 MB,
 * 40 個學期同時留在 query cache 裡手機會被殺掉。這裡取回後立刻縮成
 * 每位老師一列 + 有撤選的課,原始 JSON 交給 GC。
 *
 * 磁碟上的 Cache Storage 仍然存著原始檔（`fetchSemesterIndex` 的版本化快取），
 * 所以重新整理不會再下載一次。
 */
export function withdrawalSummaryQueryOptions(meta: Meta, semester: SemesterPath) {
  const version =
    meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'

  return queryOptions({
    queryKey: ['withdrawal-summary', semester, version],
    queryFn: async () => {
      const index = await fetchSemesterIndex(meta, semester)
      return summarizeSemester(semester, index.courses)
    },
    staleTime: Infinity,
  })
}

export interface WithdrawalRange {
  merged: MergedWithdrawal
  /** 已經彙總好的學期數。載入中就先算已到的,不要整頁空白等 40 支請求。 */
  loaded: number
  total: number
  pending: boolean
  error: Error | null
}

/**
 * 一次抓多個學期並彙總。
 *
 * 用 `combine` 而不是自己 `useMemo`:`useQueries` 每次 render 都回傳新陣列,
 * 自己包 memo 永遠不會命中。`combine` 是 TanStack 針對這件事提供的入口,
 * 它會依結果本身做快取。
 */
export function useWithdrawalRange(
  meta: Meta,
  semesters: readonly SemesterPath[],
): WithdrawalRange {
  return useQueries({
    queries: semesters.map((s) => withdrawalSummaryQueryOptions(meta, s)),
    combine: (results) => {
      const done = results.flatMap((r) => (r.data ? [r.data] : []))
      return {
        merged: mergeSummaries(done),
        loaded: done.length,
        total: results.length,
        pending: results.some((r) => r.isPending),
        error: results.find((r) => r.error)?.error ?? null,
      }
    },
  })
}
