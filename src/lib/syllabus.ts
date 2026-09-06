import type {
  SemesterPath,
  Syllabus,
  SyllabusFetchInfo,
  SyllabusProgress,
} from '@/types/api'

/**
 * 教學大綱的四種狀態。
 *
 * 關鍵是第四態:**有大綱連結、crawler 還沒抓到**。大綱正在往回補的期間會大量
 * 出現,和「這門課根本沒有大綱」是完全不同的意思,不能混為一談。
 */
export type SyllabusState =
  /** 這個學期整個沒有收錄大綱 —— 不要讓使用者一門一門點進去撞空。 */
  | { kind: 'semester-not-covered' }
  /** 這門課在學校系統裡就沒有大綱連結(115-1 有 808 門)。 */
  | { kind: 'no-syllabus' }
  /** 有連結,但還沒被抓下來。 */
  | { kind: 'pending' }
  /** 檔案在,`version` 是該門課的抓取時間,拿來當快取版本號。 */
  | { kind: 'available'; version: string }

/**
 * 判斷某門課的大綱狀態。
 *
 * **完全由 `syllabus.json` 決定,不寫死學期。** 使用者的 crawler 正在補其他學期
 * 的大綱,寫死「只有 115-1 有」會在資料補上的當天就變成錯的。
 *
 * 也因此**不需要靠 404 判斷** —— 檔案存不存在在對照表裡就有了。
 */
/**
 * 取出某門課的抓取時間。
 *
 * schema v3 把值從時間字串改成 `{ at }` 物件。兩種都吃得下 —— 爬蟲回退版本時
 * 不該讓整個大綱功能壞掉。
 */
function fetchedAt(value: SyllabusFetchInfo | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value.at
}

/**
 * 路由 loader 專用:只有在**逐課對照表確認檔案存在**時才回傳版本號。
 *
 * 為什麼不直接用 `syllabusState()`:凍結學期沒有逐課對照,存在性得看
 * `syllabus_url`,而那要等系所檔回來才知道。光憑「學期凍結了」就預取,
 * 等於對那三成沒有大綱的課發 404 —— 正是驗收條件禁止的事。
 *
 * 凍結學期的大綱因此晚一個來回,由元件在拿到課程物件之後才取。
 */
export function confirmedSyllabusVersion(
  progress: SyllabusProgress,
  semester: SemesterPath,
  courseId: string,
): string | undefined {
  return fetchedAt(progress.fetched[semester]?.[courseId])
}

export function syllabusState(
  progress: SyllabusProgress,
  semester: SemesterPath,
  courseId: string,
  syllabusUrl: string | null,
): SyllabusState {
  // 1. 逐課對照表:檔案確實在手上,最可靠
  const version = fetchedAt(progress.fetched[semester]?.[courseId])
  // 旗標與實際檔案打架時以檔案為準 —— 檔案在手上,顯示它沒有 404 風險
  if (version !== undefined) return { kind: 'available', version }

  // 2. 已凍結的學期不逐課列出(六千多筆沒有意義)。`fetched === with_url` 代表
  //    有連結的課全部抓完了,所以存在性回頭用 syllabus_url 判斷就夠準
  const frozen = progress.frozen?.[semester]
  if (frozen) {
    if (syllabusUrl === null) return { kind: 'no-syllabus' }
    return { kind: 'available', version: frozen.at }
  }

  // 3. 都沒有 —— 這個學期到底收錄了沒?
  const entry = progress.semesters.find((s) => s.semester === semester)
  if (!entry || entry.fetched === 0) return { kind: 'semester-not-covered' }

  if (syllabusUrl === null) return { kind: 'no-syllabus' }
  return { kind: 'pending' }
}

/**
 * 型別已宣告的欄位。多出來的都當成「學校/crawler 新增的東西」。
 *
 * 這份清單和 `types/api.ts` 的 `Syllabus` 必須一致 —— 加欄位時兩邊要一起改,
 * 否則新欄位會被當成未知欄位渲染兩次。
 */
const KNOWN_KEYS = new Set([
  'schema_version',
  'year',
  'sem',
  'course_id',
  'course_name',
  'teachers',
  'department_ids',
  'url',
  'fetched_at',
  'has_content',
  'teacher_name',
  'teacher_email',
  'updated_at',
  'outline',
  'schedule',
  'flexible_learning',
  'assessment',
  'materials',
  'contact',
  'extended_resources',
  'sdgs',
  'ai_usage',
  'notes',
  // schema v3 的中繼資料,不是給使用者看的內容
  'content_hash',
])

export interface UnknownField {
  key: string
  value: unknown
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * 列出型別沒宣告的欄位,讓學校新加的內容不會憑空消失。
 *
 * 大綱是平鋪的,實測沒有任何一份有 `extra` 欄位。所以這裡列的是**所有未知的
 * 頂層欄位**,並額外支援 `extra` 這種包裝形式,兩種都涵蓋。
 */
export function unknownSyllabusFields(syllabus: Syllabus): UnknownField[] {
  const source = syllabus as unknown as Record<string, unknown>
  const fields: UnknownField[] = []

  for (const [key, value] of Object.entries(source)) {
    if (KNOWN_KEYS.has(key)) continue
    if (key === 'extra') {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value)) {
          if (!isEmpty(v)) fields.push({ key: k, value: v })
        }
      }
      continue
    }
    if (!isEmpty(value)) fields.push({ key, value })
  }

  return fields
}

export interface SyllabusCoverage {
  /** 有收錄大綱的學期,由新到舊。 */
  semesters: SemesterPath[]
  /** 收錄到最舊的那個學期。沒有任何涵蓋時為 `null`。 */
  oldest: SemesterPath | null
  /** 已抓下來的大綱總份數。 */
  total: number
}

/**
 * 算出目前收錄了哪些學期的大綱。
 *
 * 為什麼要算而不是寫死:大綱正在**往回補**,寫死「只涵蓋 110-1 以後」這種句子
 * 在補到 109 的那天就變成錯的 —— 而且沒有人會發現,因為它讀起來還是很合理。
 *
 * 兩個來源都要看:更新中的學期在 `semesters[]`,抓完的搬到 `frozen`。
 * 只看其中一邊會漏掉九成的學期。
 */
export function syllabusCoverage(
  progress: SyllabusProgress,
  order: readonly SemesterPath[],
): SyllabusCoverage {
  const counts = new Map<SemesterPath, number>()

  for (const entry of progress.semesters) {
    if (entry.fetched > 0) counts.set(entry.semester, entry.fetched)
  }
  // 凍結的摘要覆蓋掉 `semesters[]` 的同一筆 —— 同一個數字,不會重複累加
  for (const [semester, frozen] of Object.entries(progress.frozen ?? {})) {
    if (frozen.fetched > 0) counts.set(semester, frozen.fetched)
  }

  // meta 的順序才是權威(字串排序會把 109-2 排在 110-1 前面是對的,
  // 但 99-1 那種舊學期就會排錯)。meta 沒列到的接在後面,不靜默丟掉
  const known = order.filter((s) => counts.has(s))
  const extra = [...counts.keys()].filter((s) => !order.includes(s))
  const semesters = [...known, ...extra]

  return {
    semesters,
    oldest: semesters[semesters.length - 1] ?? null,
    total: [...counts.values()].reduce((sum, n) => sum + n, 0),
  }
}
