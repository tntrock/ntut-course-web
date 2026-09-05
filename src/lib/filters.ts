import type { CourseIndexEntry } from '@/types/api'

/**
 * `language` 為 `null` 代表中文(實測佔 81.6%)。網址上不能放 `null`,
 * 所以用這個哨兵值代表它。其餘語言值直接用資料裡的原字串 ——
 * 選項由資料動態產生,不 hard-code(實測有 `英語`、`中英雙語`,未來可能更多)。
 */
export const LANGUAGE_ZH = 'zh'

/**
 * 時段格子,格式 `{day}-{period}`,例如 `5-2` = 週五第 2 節。
 *
 * 刻意**不用**「星期陣列 × 節次陣列」的交叉乘積:使用者在 14×7 網格上點了
 * 「週五第2節」與「週三第7節」時,交叉乘積會把「週五第7節」「週三第2節」
 * 也算進去,那是錯的。
 */
export type SlotKey = string

export type TimeMode = 'includes' | 'only'

export interface Filters {
  departments: string[]
  requirementTypes: string[]
  languages: string[]
  slots: SlotKey[]
  /**
   * `includes` = 有任一節落在選取範圍;
   * `only` = 整門課的每一節都在選取範圍內(「幫我找週五下午有空能塞的課」)。
   */
  timeMode: TimeMode
  creditsMin: number | null
  creditsMax: number | null
  teacherCode: string | null
  classId: string | null
  /**
   * 學程與教室只給課號清單,所以先取出課號集合再交給這裡。
   * `null` = 不篩選;空 Set = 沒有任何課符合(**不是**不篩選)。
   */
  courseIdSet: Set<string> | null
}

export function emptyFilters(): Filters {
  return {
    departments: [],
    requirementTypes: [],
    languages: [],
    slots: [],
    timeMode: 'includes',
    creditsMin: null,
    creditsMax: null,
    teacherCode: null,
    classId: null,
    courseIdSet: null,
  }
}

export function slotKey(day: number, period: string): SlotKey {
  return `${day}-${period}`
}

/** 課程實際佔用的所有格子。 */
function courseSlots(c: CourseIndexEntry): SlotKey[] {
  return c.time_slots.flatMap((ts) => ts.periods.map((p) => slotKey(ts.day, p)))
}

function matchesTime(c: CourseIndexEntry, selected: Set<SlotKey>, mode: TimeMode) {
  const own = courseSlots(c)

  // 使用者是在挑時間,沒有時段的課(班週會、跨校選課等)給不出答案 —— 排除
  if (own.length === 0) return false

  return mode === 'only'
    ? own.every((s) => selected.has(s))
    : own.some((s) => selected.has(s))
}

function matchesCredits(c: CourseIndexEntry, min: number | null, max: number | null) {
  // 學分未知時無法判斷落不落在範圍內,有範圍條件就排除
  if (c.credits === null) return false
  if (min !== null && c.credits < min) return false
  if (max !== null && c.credits > max) return false
  return true
}

export function applyFilters<T extends CourseIndexEntry>(
  courses: readonly T[],
  f: Filters,
): T[] {
  const departments = new Set(f.departments)
  const requirementTypes = new Set(f.requirementTypes)
  const languages = new Set(f.languages)
  const slots = new Set(f.slots)
  const hasCredits = f.creditsMin !== null || f.creditsMax !== null

  return courses.filter((c) => {
    if (departments.size > 0 && !c.department_ids.some((d) => departments.has(d))) {
      return false
    }

    if (
      requirementTypes.size > 0 &&
      (c.requirement_type === null || !requirementTypes.has(c.requirement_type))
    ) {
      return false
    }

    if (languages.size > 0 && !languages.has(c.language ?? LANGUAGE_ZH)) {
      return false
    }

    if (slots.size > 0 && !matchesTime(c, slots, f.timeMode)) {
      return false
    }

    if (hasCredits && !matchesCredits(c, f.creditsMin, f.creditsMax)) {
      return false
    }

    if (f.teacherCode !== null && !c.teacher_codes.includes(f.teacherCode)) {
      return false
    }

    if (f.classId !== null && !c.class_ids.includes(f.classId)) {
      return false
    }

    if (f.courseIdSet !== null && !f.courseIdSet.has(c.id)) {
      return false
    }

    return true
  })
}

/** 目前套用了幾個條件 —— 手機版的「已套用 N 個條件」用這個。 */
export function activeFilterCount(f: Filters): number {
  let n = 0
  if (f.departments.length > 0) n++
  if (f.requirementTypes.length > 0) n++
  if (f.languages.length > 0) n++
  if (f.slots.length > 0) n++
  if (f.creditsMin !== null || f.creditsMax !== null) n++
  if (f.teacherCode !== null) n++
  if (f.classId !== null) n++
  if (f.courseIdSet !== null) n++
  return n
}
