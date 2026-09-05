import { emptyFilters, type Filters, type TimeMode } from './filters'

/**
 * 搜尋條件全部放在網址上,所以網址可分享、可加書籤、上一頁行為正確。
 *
 * TanStack Router 預設把陣列序列化成 JSON(`?dept=%5B%2259%22%5D`),
 * 人看不懂也不好手改。這裡改用**重複 key**(`?dept=59&dept=31`),
 * 逗號不行 —— 值裡本來就可能含逗號。
 *
 * 網址是使用者可以任意編輯的輸入,所以一律驗證後才進到狀態裡。
 */

/** 會收成陣列的參數。只出現一次也是陣列,呼叫端不必判斷型別。 */
const ARRAY_KEYS = new Set(['dept', 'req', 'lang', 'slot'])

const TIME_MODES = ['includes', 'only'] as const
const SORTS = ['relevance', 'name', 'credits', 'enrolled'] as const

export type SortKey = (typeof SORTS)[number]

export interface SearchParams {
  q?: string
  sem?: string
  dept?: string[]
  req?: string[]
  lang?: string[]
  slot?: string[]
  time?: TimeMode
  cmin?: number
  cmax?: number
  teacher?: string
  class?: string
  program?: string
  classroom?: string
  sort?: SortKey
}

// ─── 序列化 ───────────────────────────────────────────────────

export function stringifySearch(params: Record<string, unknown>): string {
  const usp = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          usp.append(key, String(item))
        }
      }
      continue
    }

    usp.append(key, String(value))
  }

  const qs = usp.toString()
  return qs === '' ? '' : `?${qs}`
}

export function parseSearch(search: string): Record<string, unknown> {
  const usp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out: Record<string, unknown> = {}

  for (const key of new Set(usp.keys())) {
    const values = usp.getAll(key)
    out[key] = ARRAY_KEYS.has(key) || values.length > 1 ? values : values[0]
  }

  return out
}

// ─── 驗證 ─────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value]
  const items = raw.filter((v): v is string => typeof v === 'string' && v !== '')
  return items.length > 0 ? items : undefined
}

/** 非負的有限數字;其餘一律丟掉,不要讓 NaN 流進狀態。 */
function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? value : undefined
  if (typeof value !== 'string' || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/** `5-2` = 週五第 2 節。星期 0–6,節次是 `meta.periods` 裡的代碼。 */
const SLOT_PATTERN = /^([0-6])-([0-9A-Za-z]+)$/

function asSlots(value: unknown): string[] | undefined {
  const items = asStringArray(value)?.filter((s) => SLOT_PATTERN.test(s))
  return items && items.length > 0 ? items : undefined
}

/**
 * 只挑出認得的參數。不認得的一律丟掉 ——
 * 網址是使用者可編輯的輸入,不該讓任意 key 進到應用程式狀態。
 */
export function validateSearchParams(input: Record<string, unknown>): SearchParams {
  const out: SearchParams = {}

  const q = asString(input['q'])
  if (q !== undefined) out.q = q

  const sem = asString(input['sem'])
  if (sem !== undefined) out.sem = sem

  const dept = asStringArray(input['dept'])
  if (dept !== undefined) out.dept = dept

  const req = asStringArray(input['req'])
  if (req !== undefined) out.req = req

  const lang = asStringArray(input['lang'])
  if (lang !== undefined) out.lang = lang

  const slot = asSlots(input['slot'])
  if (slot !== undefined) out.slot = slot

  const time = asEnum(input['time'], TIME_MODES)
  if (time !== undefined) out.time = time

  const cmin = asNumber(input['cmin'])
  if (cmin !== undefined) out.cmin = cmin

  const cmax = asNumber(input['cmax'])
  if (cmax !== undefined) out.cmax = cmax

  const teacher = asString(input['teacher'])
  if (teacher !== undefined) out.teacher = teacher

  const klass = asString(input['class'])
  if (klass !== undefined) out.class = klass

  const program = asString(input['program'])
  if (program !== undefined) out.program = program

  const classroom = asString(input['classroom'])
  if (classroom !== undefined) out.classroom = classroom

  const sort = asEnum(input['sort'], SORTS)
  if (sort !== undefined) out.sort = sort

  return out
}

// ─── 轉成篩選狀態 ─────────────────────────────────────────────

/**
 * @param courseIdSet 學程 / 教室篩選出來的課號集合。`null` = 不以課號篩選。
 */
export function toFilters(
  params: SearchParams,
  courseIdSet: Set<string> | null,
): Filters {
  return {
    ...emptyFilters(),
    departments: params.dept ?? [],
    requirementTypes: params.req ?? [],
    languages: params.lang ?? [],
    slots: params.slot ?? [],
    timeMode: params.time ?? 'includes',
    creditsMin: params.cmin ?? null,
    creditsMax: params.cmax ?? null,
    teacherCode: params.teacher ?? null,
    classId: params.class ?? null,
    courseIdSet,
  }
}
