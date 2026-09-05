import type { CourseIndexEntry } from '@/types/api'
import { applyFilters, type Filters } from './filters'
import { buildIndex, search, type SearchDoc } from './search'
import type { SortKey } from './searchParams'
import { sortCourses } from './sort'
import { suggestRelaxations, type Relaxation } from './suggest'

/**
 * 搜尋跑在 Worker 裡,主執行緒只送查詢、收課號。
 *
 * 2,717 筆的掃描本身只有毫秒級,放進 Worker 的真正理由是**輸入的流暢度**:
 * 使用者在輸入框連打時,主執行緒要留給按鍵回饋與捲動,不能被比對佔住。
 */

/** DOM 與 WebWorker 的 lib 型別衝突,用最小介面繞開,不必為 worker 另開 tsconfig。 */
const ctx = globalThis as unknown as {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
}

export type WorkerRequest =
  | { type: 'load'; courses: CourseIndexEntry[] }
  | {
      type: 'query'
      seq: number
      query: string
      filters: Filters
      sort: SortKey
    }

export type WorkerResponse =
  | { type: 'ready'; count: number }
  | {
      type: 'result'
      seq: number
      ids: string[]
      total: number
      /** 只有在沒有結果時才會算,有結果時是空陣列。 */
      suggestions: Relaxation[]
      /** 這次查詢在 Worker 裡花了幾毫秒。 */
      ms: number
    }

let courses: CourseIndexEntry[] = []
let docs: SearchDoc[] = []

/** 跑完整條管線:關鍵字 → 篩選 → 排序。 */
function run(query: string, filters: Filters, sort: SortKey) {
  const results = search(docs, query)
  const scores = new Map(results.map((r) => [r.id, r.score]))
  const matched = new Set(results.map((r) => r.id))

  const filtered = applyFilters(
    courses.filter((c) => matched.has(c.id)),
    filters,
  )

  return sortCourses(filtered, sort, scores)
}

ctx.addEventListener('message', (event) => {
  const request = event.data as WorkerRequest

  if (request.type === 'load') {
    courses = request.courses
    docs = buildIndex(courses)
    const response: WorkerResponse = { type: 'ready', count: courses.length }
    ctx.postMessage(response)
    return
  }

  if (request.type === 'query') {
    const started = performance.now()
    const matched = run(request.query, request.filters, request.sort)

    // 有結果時不必算建議,省下重跑好幾輪篩選的成本
    const suggestions =
      matched.length === 0
        ? suggestRelaxations(
            (q, f) => run(q, f, request.sort).length,
            request.query,
            request.filters,
          )
        : []

    const response: WorkerResponse = {
      type: 'result',
      seq: request.seq,
      ids: matched.map((c) => c.id),
      total: matched.length,
      suggestions,
      ms: Math.round(performance.now() - started),
    }
    ctx.postMessage(response)
  }
})
