import { useEffect, useMemo, useRef, useState } from 'react'
import type { CourseIndexEntry } from '@/types/api'
import type { Filters } from '@/lib/filters'
import type { SortKey } from '@/lib/searchParams'
import type { Relaxation } from '@/lib/suggest'
import type { WorkerRequest, WorkerResponse } from '@/lib/search.worker'

export interface SearchState {
  courses: CourseIndexEntry[]
  total: number
  suggestions: Relaxation[]
  /** 第一次建索引完成前為 true。 */
  loading: boolean
  /** 最近一次查詢在 Worker 裡花的毫秒數,用來驗證效能預算。 */
  ms: number
}

/**
 * 把搜尋交給 Worker,回傳排好序的課程。
 *
 * 每次查詢帶一個遞增的 `seq`,只採用最新那次的結果 —— 使用者連打時前一次的
 * 回覆可能後到,不擋掉的話畫面會閃回舊結果。
 */
export function useCourseSearch(
  allCourses: readonly CourseIndexEntry[],
  query: string,
  filters: Filters,
  sort: SortKey,
): SearchState {
  const workerRef = useRef<Worker | null>(null)
  const seqRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<{
    ids: string[]
    total: number
    suggestions: Relaxation[]
    ms: number
  }>({ ids: [], total: 0, suggestions: [], ms: 0 })

  const byId = useMemo(() => new Map(allCourses.map((c) => [c.id, c])), [allCourses])

  // Worker 只建一次,課程換了(切學期)才重新載入
  useEffect(() => {
    const worker = new Worker(new URL('../lib/search.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    // 換學期會重建 Worker,索引要重新建立 —— 這正是「與外部系統同步」,
    // 不是可以在 render 期算出來的衍生狀態
    // oxlint-disable-next-line react/set-state-in-effect
    setReady(false)

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') {
        setReady(true)
        return
      }
      // 過期的回覆直接丟掉
      if (message.seq !== seqRef.current) return
      setResult({
        ids: message.ids,
        total: message.total,
        suggestions: message.suggestions,
        ms: message.ms,
      })
    })

    const load: WorkerRequest = { type: 'load', courses: [...allCourses] }
    worker.postMessage(load)

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [allCourses])

  useEffect(() => {
    if (!ready || !workerRef.current) return
    seqRef.current += 1
    const request: WorkerRequest = {
      type: 'query',
      seq: seqRef.current,
      query,
      filters,
      sort,
    }
    workerRef.current.postMessage(request)
  }, [ready, query, filters, sort])

  const courses = useMemo(
    () => result.ids.map((id) => byId.get(id)).filter((c) => c !== undefined),
    [result.ids, byId],
  )

  return {
    courses,
    total: result.total,
    suggestions: result.suggestions,
    loading: !ready,
    ms: result.ms,
  }
}
