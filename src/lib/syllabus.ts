import type { SemesterPath, Syllabus, SyllabusProgress } from '@/types/api'

/**
 * 教學大綱的四種狀態。
 *
 * plan §1.3.5 原本寫成三態,但實測 `syllabus.json` 的 `fetched` 對照後多出
 * 第四態:**有大綱連結、crawler 還沒抓到**。這在大綱正在補齊的期間會大量出現,
 * 和「這門課根本沒有大綱」是完全不同的意思,不能混為一談。
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
export function syllabusState(
  progress: SyllabusProgress,
  semester: SemesterPath,
  courseId: string,
  syllabusUrl: string | null,
): SyllabusState {
  const entry = progress.semesters.find((s) => s.semester === semester)
  if (!entry || entry.fetched === 0) return { kind: 'semester-not-covered' }

  const version = progress.fetched[semester]?.[courseId]
  // 旗標與實際檔案打架時以檔案為準 —— 檔案在手上,顯示它沒有 404 風險
  if (version !== undefined) return { kind: 'available', version }

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
 * plan §3.3 原本指定渲染 `extra` 欄位,但實測 273 份大綱都沒有這個欄位 ——
 * schema v2 是平鋪的。所以這裡列的是**所有未知的頂層欄位**,並額外支援
 * `extra` 這種包裝形式,兩種都涵蓋。
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
