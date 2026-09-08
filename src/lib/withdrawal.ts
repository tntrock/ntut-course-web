import { hasEnrolment } from './course'
import type { CourseIndexEntry, SemesterPath } from '@/types/api'

/**
 * 退選率。
 *
 * **分母是「人 + 撤」。** 原始頁面的「人」是**目前**選課人數（撤選的已經扣掉），
 * 「撤」是目前退選人數 —— 所以原始修課人次要把撤選的加回來。
 *
 * 用「撤 / 人」會系統性高估：某門課撤 17、現存 30，`撤/(人+撤)` 是 36.2%，
 * `撤/人` 卻是 56.7%。
 *
 * ⚠️ **退選率高不等於老師教得差。** 可能是擋修的必修、時段很爛、或課本身就難。
 * 畫面上一定要把原始人次擺在比率旁邊，讓讀者自己判斷樣本大小。
 */
export function withdrawalRate(
  enrolled: number | null,
  withdrawn: number | null,
): number {
  const w = withdrawn ?? 0
  const base = (enrolled ?? 0) + w
  return base === 0 ? 0 : w / base
}

/* ── 跨學期彙總 ───────────────────────────────────────────────────────────── */

/**
 * 一個學期壓縮後的退選統計。
 *
 * **不要把整份索引留在記憶體裡。**「所有期間」是 40 個學期、12 萬門課,
 * 全部展開約 140 MB,手機會直接被系統殺掉。所以取回索引後立刻縮成這個結構,
 * 原始 JSON 交給 GC —— 磁碟上的 Cache Storage 仍然留著,重載不必再下載。
 */
export interface SemesterSummary {
  semester: SemesterPath
  /** 95-1 以前的原始頁面沒有「人」「撤」兩欄,整個學期都是 null。 */
  hasData: boolean
  enrolled: number
  withdrawn: number
  teachers: TeacherTally[]
  courses: CourseTally[]
}

export interface TeacherTally {
  code: string
  name: string
  enrolled: number
  withdrawn: number
  courseCount: number
  /** 有人撤選的那幾門。比率要有脈絡,才讀得出是哪門課造成的。 */
  withdrawnCourses: string[]
}

export interface CourseTally {
  id: string
  semester: SemesterPath
  name: string
  teachers: string[]
  enrolled: number
  withdrawn: number
}

export function summarizeSemester(
  semester: SemesterPath,
  courses: readonly CourseIndexEntry[],
): SemesterSummary {
  const tally = new Map<string, TeacherTally>()
  const rows: CourseTally[] = []
  let enrolled = 0
  let withdrawn = 0
  let hasData = false

  for (const c of courses) {
    // 96-1 以前這兩個鍵不存在,不是 null —— `!== null` 會讓 undefined 溜過去
    if (hasEnrolment(c) || (c.withdrawn ?? null) !== null) hasData = true
    const e = c.enrolled ?? 0
    const w = c.withdrawn ?? 0
    enrolled += e
    withdrawn += w

    // 沒人撤選的課只影響分母,留著課名純粹是浪費記憶體
    if (w > 0) {
      rows.push({
        id: c.id,
        semester,
        name: c.name_zh,
        teachers: c.teachers,
        enrolled: e,
        withdrawn: w,
      })
    }

    c.teacher_codes.forEach((code, i) => {
      let t = tally.get(code)
      if (!t) {
        // 姓名直接取自索引:實測 3 個學期 7,956 組 teacher_codes[i] ↔ teachers[i]
        // 全部對得上,省掉每學期一支 89 KB 的 teachers.json。對不上就退回代碼
        t = {
          code,
          name: c.teachers[i] ?? code,
          enrolled: 0,
          withdrawn: 0,
          courseCount: 0,
          withdrawnCourses: [],
        }
        tally.set(code, t)
      }
      t.enrolled += e
      t.withdrawn += w
      t.courseCount += 1
      if (w > 0) t.withdrawnCourses.push(c.name_zh)
    })
  }

  return {
    semester,
    hasData,
    enrolled,
    withdrawn,
    teachers: [...tally.values()],
    courses: rows,
  }
}

export interface MergedWithdrawal {
  /** 真的有人數資料、算進統計的學期。 */
  semesters: SemesterPath[]
  /** 下載了但整欄空白、被排除的學期。要講出來,不然數字對不上使用者的預期。 */
  skipped: SemesterPath[]
  enrolled: number
  withdrawn: number
  teachers: TeacherTally[]
  courses: CourseTally[]
}

/**
 * 把多個學期併成一份。
 *
 * **教師跨學期加總,課程不併。** 課號每學期都會換,把不同學期的「工程力學」
 * 併成一列,等於自己造一個資料裡沒有的東西 —— 所以課程列保留學期標籤。
 */
export function mergeSummaries(
  summaries: readonly SemesterSummary[],
): MergedWithdrawal {
  const tally = new Map<string, TeacherTally>()
  const semesters: SemesterPath[] = []
  const skipped: SemesterPath[] = []
  const courses: CourseTally[] = []
  let enrolled = 0
  let withdrawn = 0

  for (const s of summaries) {
    if (!s.hasData) {
      skipped.push(s.semester)
      continue
    }
    semesters.push(s.semester)
    enrolled += s.enrolled
    withdrawn += s.withdrawn
    courses.push(...s.courses)

    for (const t of s.teachers) {
      const prev = tally.get(t.code)
      if (!prev) {
        tally.set(t.code, { ...t, withdrawnCourses: [...t.withdrawnCourses] })
        continue
      }
      prev.enrolled += t.enrolled
      prev.withdrawn += t.withdrawn
      prev.courseCount += t.courseCount
      prev.withdrawnCourses.push(...t.withdrawnCourses)
      // 老師改名時以最新的為準:summaries 由新到舊,先寫進去的那個留著
    }
  }

  return {
    semesters,
    skipped,
    enrolled,
    withdrawn,
    teachers: [...tally.values()],
    courses,
  }
}

/* ── 統計基準線 ───────────────────────────────────────────────────────────── */

export interface WithdrawalStats {
  n: number
  mean: number
  sd: number
  p25: number
  p50: number
  p75: number
}

/**
 * 排行榜最容易被讀成黑名單。給出平均與離散程度,47% 才看得出是極端值、
 * 3% 才看得出是常態。
 */
export function withdrawalStats(rates: readonly number[]): WithdrawalStats {
  const n = rates.length
  if (n === 0) return { n: 0, mean: 0, sd: 0, p25: 0, p50: 0, p75: 0 }

  const sorted = [...rates].sort((a, b) => a - b)
  const at = (p: number) => sorted[Math.floor((n - 1) * p)] ?? 0
  const mean = sorted.reduce((s, x) => s + x, 0) / n
  const sd = Math.sqrt(sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n)

  return { n, mean, sd, p25: at(0.25), p50: at(0.5), p75: at(0.75) }
}

export interface Row {
  /** 教師代碼或課號。 */
  key: string
  name: string
  rate: number
  enrolled: number
  withdrawn: number
  /** 原始修課人次(人 + 撤)。 */
  base: number
  /** 教師列放造成撤選的課名,課程列放授課教師。 */
  detail: string[]
  /** 只有課程列有 —— 跨學期時要知道是哪一次開課。教師列不標,那是跨學期的合計。 */
  semester?: SemesterPath
}

export interface RateGroup {
  label: string
  /** 這一組的門檻。不寫出來,分組就只是無法解釋的色塊。 */
  hint: string
  rows: Row[]
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`

/**
 * 依退選率分三組。
 *
 * 「明顯偏高」用平均 + 1 個標準差,不是寫死的百分比 —— 全校平均會隨學期
 * 與所選期間變動,固定門檻隔一年就沒有意義。
 */
export function rateGroups(rows: readonly Row[], stats: WithdrawalStats): RateGroup[] {
  if (rows.length === 0) return []

  const high = stats.mean + stats.sd
  const mid = stats.p50

  return [
    {
      label: '明顯偏高',
      hint: `${pct(high)} 以上`,
      rows: rows.filter((r) => r.rate >= high),
    },
    {
      label: '一般',
      hint: `${pct(mid)} – ${pct(high)}`,
      rows: rows.filter((r) => r.rate < high && r.rate >= mid),
    },
    {
      label: '偏低',
      hint: `${pct(mid)} 以下`,
      rows: rows.filter((r) => r.rate < mid),
    },
  ].filter((g) => g.rows.length > 0)
}

/** 最少原始修課人次。不擋的話榜首永遠是「3 人修、2 人撤」。 */
export const MIN_OPTIONS = [0, 30, 50, 100] as const

export const GROUPINGS = ['rate', 'none'] as const
export type Grouping = (typeof GROUPINGS)[number]

export const GROUP_LABELS: Record<Grouping, string> = {
  rate: '依退選率',
  none: '不分組',
}

export const SORTS = ['rate-desc', 'rate-asc', 'withdrawn', 'base', 'name'] as const
export type Sort = (typeof SORTS)[number]

export const SORT_LABELS: Record<Sort, string> = {
  'rate-desc': '退選率高到低',
  'rate-asc': '退選率低到高',
  withdrawn: '退選人數多到少',
  base: '修課人次多到少',
  name: '名稱',
}

/** 不改動輸入陣列 —— 呼叫端拿到的通常是 memo 過的結果。 */
export function sortRows(rows: readonly Row[], sort: Sort): Row[] {
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    // 同比率時撤選人數多的在前,順序才穩定
    'rate-desc': (a, b) => b.rate - a.rate || b.withdrawn - a.withdrawn,
    'rate-asc': (a, b) => a.rate - b.rate || b.withdrawn - a.withdrawn,
    withdrawn: (a, b) => b.withdrawn - a.withdrawn || b.rate - a.rate,
    base: (a, b) => b.base - a.base || b.rate - a.rate,
    // zh-Hant 是筆畫序(王 古 吳 李 林 陳),不是 UTF-16 碼位序
    name: (a, b) => a.name.localeCompare(b.name, 'zh-Hant'),
  }
  return [...rows].sort(cmp[sort])
}

function toRow(
  key: string,
  name: string,
  enrolled: number,
  withdrawn: number,
  detail: string[],
  semester?: SemesterPath,
): Row {
  const row: Row = {
    key,
    name,
    enrolled,
    withdrawn,
    base: enrolled + withdrawn,
    rate: withdrawalRate(enrolled, withdrawn),
    detail,
  }
  if (semester !== undefined) row.semester = semester
  return row
}

/** 課名重複時只留一次 —— 同一門課連開三個學期不必寫三遍。 */
function unique(names: readonly string[]): string[] {
  return [...new Set(names)]
}

/** 比率由高到低;同比率時撤選人數多的在前,順序才穩定。 */
function ranked(rows: Row[]): Row[] {
  return rows.sort((a, b) => b.rate - a.rate || b.withdrawn - a.withdrawn)
}

export function teacherRows(merged: MergedWithdrawal, minBase: number): Row[] {
  return ranked(
    merged.teachers
      .map((t) =>
        toRow(t.code, t.name, t.enrolled, t.withdrawn, unique(t.withdrawnCourses)),
      )
      // 沒有人撤選的老師列出來只是佔位子
      .filter((r) => r.withdrawn > 0 && r.base >= minBase),
  )
}

export function courseRows(merged: MergedWithdrawal, minBase: number): Row[] {
  return ranked(
    merged.courses
      .map((c) => toRow(c.id, c.name, c.enrolled, c.withdrawn, c.teachers, c.semester))
      .filter((r) => r.base >= minBase),
  )
}

/** 教師姓名或課程名稱的模糊比對。 */
export function matchRow(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (row.name.toLowerCase().includes(q)) return true
  return row.detail.some((d) => d.toLowerCase().includes(q))
}
