import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { fetchMeta } from '@/lib/api'

/**
 * `meta.json` 是所有其他請求的前置 —— 學期清單、節次時刻、以及快取版本號
 * 都從這裡來,所以它自己不帶版本號、永遠 network-first(見 `lib/api.ts`)。
 */
export function metaQueryOptions() {
  return queryOptions({
    queryKey: ['meta'],
    queryFn: fetchMeta,
    // 每次進站重抓一次就好;真正的資料新鮮度由各端點的版本號決定
    staleTime: 1000 * 60 * 5,
  })
}

export function useMeta() {
  return useSuspenseQuery(metaQueryOptions()).data
}
