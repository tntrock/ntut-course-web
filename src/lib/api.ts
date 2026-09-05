import type { CourseIndex, DepartmentsResponse, Meta, SemesterPath } from '@/types/api'

const BASE = (
  import.meta.env.VITE_API_BASE ?? 'https://tntrock.github.io/ntut-course-crawler'
).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(status: number, path: string) {
    super(`取得 ${path} 失敗(HTTP ${status})`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

export const API_CACHE_NAME = 'ntut-api-v1'

/**
 * 開啟 API 快取。無痕視窗、舊瀏覽器、或使用者停用網站資料時會拿不到 ——
 * 這時回傳 `null`,呼叫端改走純網路,**功能不能因此壞掉**。
 */
async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(API_CACHE_NAME)
  } catch {
    return null
  }
}

export async function fetchVersioned<T>(path: string, version: string): Promise<T> {
  const url = `${BASE}/${path}?v=${encodeURIComponent(version)}`
  const cache = await openCache()

  const hit = await cache?.match(url)
  if (hit) return (await hit.json()) as T

  const res = await fetch(url)
  if (!res.ok) throw new ApiError(res.status, path)
  if (cache) {
    await cache.put(url, res.clone())
    await evictOtherVersions(cache, url)
  }
  return (await res.json()) as T
}

export interface MetaResult {
  data: Meta
  /**
   * 資料來自離線快取而非網路。為 `true` 時 UI 要顯示離線橫幅,
   * 並用 `data.generated_at` 告訴使用者資料是什麼時候的。
   */
  fromCache: boolean
}

/**
 * 取得 `meta.json`。
 *
 * 這一支**不加版本號、永遠走網路優先** —— 它本身就是其他所有端點的版本來源,
 * 拿舊的會讓整個快取層失去意義。只有 2.4 KB,每次重抓的成本可以接受。
 * 抓不到時退回上次的快取,讓離線也能用。
 */
export async function fetchMeta(): Promise<MetaResult> {
  const url = `${BASE}/meta.json`
  const cache = await openCache()

  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new ApiError(res.status, 'meta.json')
    await cache?.put(url, res.clone())
    return { data: (await res.json()) as Meta, fromCache: false }
  } catch (err) {
    const hit = await cache?.match(url)
    if (hit) return { data: (await hit.json()) as Meta, fromCache: true }
    throw err
  }
}

/**
 * 取得某學期的快取版本號。
 *
 * **舊學期的 `generated_at` 永遠不變**,所以歷史資料只會下載一次,之後永久命中。
 * 找不到學期時直接丟錯 —— 默默改用 `meta.generated_at` 會讓每次 crawler 更新
 * 都把所有歷史資料的快取沖掉。
 */
export function semesterVersion(meta: Meta, semester: SemesterPath): string {
  const entry = meta.semesters.find((s) => s.path === semester)
  if (!entry) throw new Error(`meta.json 裡沒有學期 ${semester}`)
  return entry.generated_at
}

/** 單一學期的輕量索引 —— 搜尋的資料來源。 */
export function fetchSemesterIndex(
  meta: Meta,
  semester: SemesterPath,
): Promise<CourseIndex> {
  return fetchVersioned<CourseIndex>(
    `${semester}/index.json`,
    semesterVersion(meta, semester),
  )
}

/** 學院 / 系所 / 班級三層對照。gzip 約 5 KB。 */
export function fetchDepartments(
  meta: Meta,
  semester: SemesterPath,
): Promise<DepartmentsResponse> {
  return fetchVersioned<DepartmentsResponse>(
    `${semester}/departments.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 刪掉同一路徑的其他版本。
 *
 * 沒有這步的話,每次 crawler 更新都會在 Cache Storage 留下一份舊資料,
 * 使用者的配額遲早被吃光。
 */
async function evictOtherVersions(cache: Cache, keepUrl: string): Promise<void> {
  const prefix = keepUrl.split('?')[0]
  if (prefix === undefined) return
  const stale = (await cache.keys()).filter(
    (req) => req.url !== keepUrl && req.url.split('?')[0] === prefix,
  )
  await Promise.all(stale.map((req) => cache.delete(req)))
}
