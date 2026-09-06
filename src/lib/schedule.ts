import type {
  CourseIndexEntry,
  Day,
  PeriodCode,
  PeriodDef,
  TimeSlot,
} from '@/types/api'
import type { CourseSnapshot, SavedCourse } from './storage'
import { slotKey } from './filters'

/**
 * 從課程物件擷取快照。
 *
 * **只留比對與離線渲染真正用得到的欄位** —— 整包存進 localStorage 會很快吃掉
 * 配額,而且大綱網址、學程、備註這些離線畫課表時根本用不到。
 */
export function toSnapshot(course: CourseIndexEntry): CourseSnapshot {
  return {
    name_zh: course.name_zh,
    teachers: [...course.teachers],
    teacher_codes: [...course.teacher_codes],
    time_slots: course.time_slots.map((s) => ({ ...s, periods: [...s.periods] })),
    classrooms: 'classrooms' in course ? [...(course.classrooms as string[])] : [],
    credits: course.credits,
    required: course.required,
    requirement_type: course.requirement_type,
    department_ids: [...course.department_ids],
  }
}

export type ScheduleChange =
  /** 最新資料裡找不到這門課。 */
  | { kind: 'removed' }
  | { kind: 'time'; from: TimeSlot[]; to: TimeSlot[] }
  | { kind: 'teachers'; from: string[]; to: string[] }
  | { kind: 'credits'; from: number | null; to: number | null }

/** 時段的正規化字串。**排序過** —— 來源資料的順序不保證穩定。 */
function timeFingerprint(slots: readonly TimeSlot[]): string {
  return slots
    .map((s) => `${s.day}:${[...s.periods].sort().join(',')}`)
    .sort()
    .join('|')
}

/**
 * 快照與最新資料的差異。
 *
 * 這一步把 crawler 的異動偵測能力接到使用者最在乎的地方:他自己那幾門課。
 * 只說「有異動」沒用,所以每一項都帶著 舊 → 新。
 */
export function diffSnapshot(
  snapshot: CourseSnapshot,
  current: CourseIndexEntry | undefined,
): ScheduleChange[] {
  if (!current) return [{ kind: 'removed' }]

  const changes: ScheduleChange[] = []

  if (timeFingerprint(snapshot.time_slots) !== timeFingerprint(current.time_slots)) {
    changes.push({ kind: 'time', from: snapshot.time_slots, to: current.time_slots })
  }

  // 教師以**代碼**比對,不是姓名 —— 同名老師有兩位,
  // 而改名字不算換人
  const before = [...snapshot.teacher_codes].sort()
  const after = [...current.teacher_codes].sort()
  if (before.join(',') !== after.join(',')) {
    changes.push({
      kind: 'teachers',
      from: snapshot.teacher_codes,
      to: current.teacher_codes,
    })
  }

  if (snapshot.credits !== current.credits) {
    changes.push({ kind: 'credits', from: snapshot.credits, to: current.credits })
  }

  return changes
}

export interface Grid {
  /** `"星期-節次"` → 佔用這一格的課。 */
  cells: Map<string, SavedCourse[]>
  /** 有兩門以上的格子。 */
  conflicts: Set<string>
  /** 沒有固定時段的課(體育、班週會,實測 249 門)。 */
  unscheduled: SavedCourse[]
}

/**
 * 把課排進格子並找出衝堂。
 *
 * **衝堂只警告不阻擋**—— 使用者可能正在比較兩個方案。
 */
export function buildGrid(courses: readonly SavedCourse[]): Grid {
  const cells = new Map<string, SavedCourse[]>()
  const unscheduled: SavedCourse[] = []

  for (const course of courses) {
    if (course.snapshot.time_slots.length === 0) {
      unscheduled.push(course)
      continue
    }

    for (const slot of course.snapshot.time_slots) {
      for (const period of slot.periods) {
        const key = slotKey(slot.day, period)
        const bucket = cells.get(key)
        if (!bucket) {
          cells.set(key, [course])
          continue
        }
        // 同一門課在同一格出現兩次(來源資料重複)不該算成自己跟自己衝堂
        if (!bucket.some((c) => c.id === course.id)) bucket.push(course)
      }
    }
  }

  const conflicts = new Set<string>()
  for (const [key, bucket] of cells) {
    if (bucket.length > 1) conflicts.add(key)
  }

  return { cells, conflicts, unscheduled }
}

export interface ScheduleStats {
  courseCount: number
  totalCredits: number
  requiredCredits: number
  electiveCredits: number
  /** `required` 為 `null`(原始欄位空白)的學分。不能塞進必修或選修任一邊。 */
  unclassifiedCredits: number
  /** 學分為 `null` 的門數。這些課算不進總學分,要講出來。 */
  unknownCreditCount: number
  /** 星期 → 該天佔用的**節數**(不是門數)。 */
  perDay: Map<Day, number>
  earliest: PeriodCode | null
  latest: PeriodCode | null
}

export function scheduleStats(
  courses: readonly SavedCourse[],
  periods: readonly PeriodDef[],
): ScheduleStats {
  const order = new Map(periods.map((p, i) => [p.code, i]))
  const perDay = new Map<Day, number>()

  let totalCredits = 0
  let requiredCredits = 0
  let electiveCredits = 0
  let unclassifiedCredits = 0
  let unknownCreditCount = 0
  let earliestRank = Number.POSITIVE_INFINITY
  let latestRank = Number.NEGATIVE_INFINITY
  let earliest: PeriodCode | null = null
  let latest: PeriodCode | null = null

  for (const { snapshot } of courses) {
    // 學分為 null 時當成 0 會讓總學分看起來是對的,其實少算 ——
    // 那比明講「N 門未提供學分」危險
    if (snapshot.credits === null) {
      unknownCreditCount += 1
    } else {
      totalCredits += snapshot.credits
      if (snapshot.required === true) requiredCredits += snapshot.credits
      else if (snapshot.required === false) electiveCredits += snapshot.credits
      else unclassifiedCredits += snapshot.credits
    }

    for (const slot of snapshot.time_slots) {
      perDay.set(slot.day, (perDay.get(slot.day) ?? 0) + slot.periods.length)

      for (const period of slot.periods) {
        // 順序一律以 meta.periods 為準 —— 字典序會說夜間的 A 比 5 早
        const rank = order.get(period)
        if (rank === undefined) continue
        if (rank < earliestRank) {
          earliestRank = rank
          earliest = period
        }
        if (rank > latestRank) {
          latestRank = rank
          latest = period
        }
      }
    }
  }

  return {
    courseCount: courses.length,
    totalCredits,
    requiredCredits,
    electiveCredits,
    unclassifiedCredits,
    unknownCreditCount,
    perDay,
    earliest,
    latest,
  }
}

export interface CourseRun {
  course: SavedCourse
  day: Day
  /** 在 `meta.periods` 裡的起始索引。 */
  start: number
  /** 佔幾格。 */
  span: number
  /** 同一時段有多門課時,這門排在第幾欄(從 0 起算)。 */
  lane: number
  /** 這一群互相重疊的課總共要分成幾欄。 */
  lanes: number
}

/**
 * 把同一天互相重疊的區段分欄。
 *
 * 不分欄的話衝堂的課會疊在同一塊,課名互相蓋掉 —— 使用者看得到「有衝堂」,
 * 卻看不出是哪兩門在撞,那正是他最需要知道的事。
 *
 * 分欄以**互相連通的一群**為單位而不是整天:早上衝堂不該讓下午那門獨立的課
 * 也跟著變成半格寬。
 */
function assignLanes(runs: Omit<CourseRun, 'lane' | 'lanes'>[]): CourseRun[] {
  const sorted = [...runs].sort((a, b) => a.start - b.start)
  const out: CourseRun[] = []

  let group: { run: (typeof sorted)[number]; lane: number }[] = []
  let groupEnd = -1

  const flush = () => {
    if (group.length === 0) return
    const lanes = Math.max(...group.map((g) => g.lane)) + 1
    for (const { run, lane } of group) out.push({ ...run, lane, lanes })
    group = []
  }

  for (const run of sorted) {
    // 與目前這一群完全沒有重疊 → 前一群結束
    if (run.start >= groupEnd) {
      flush()
      groupEnd = -1
    }

    // 找第一個已經空出來的欄位
    const laneEnds = new Map<number, number>()
    for (const { run: other, lane } of group) {
      laneEnds.set(lane, Math.max(laneEnds.get(lane) ?? -1, other.start + other.span))
    }
    let lane = 0
    while ((laneEnds.get(lane) ?? -1) > run.start) lane += 1

    group.push({ run, lane })
    groupEnd = Math.max(groupEnd, run.start + run.span)
  }
  flush()

  return out
}

/**
 * 把每門課在每一天的節次切成連續的區段,供課表格線做跨列合併。
 *
 * 不合併的話,一門三節的課會把課名印三次;硬把首尾連成一塊又會在不連續時
 * 宣稱中間那節也要上課 —— 與 `formatTime` 的 `2、4` 不能寫成 `2-4` 是同一件事。
 *
 * `meta.periods` 沒收錄的節次代碼**直接跳過**:憑空塞進某一格比不顯示更糟,
 * 使用者會照著錯的時間去上課。
 */
export function layoutRuns(
  courses: readonly SavedCourse[],
  periods: readonly PeriodDef[],
): CourseRun[] {
  const order = new Map(periods.map((p, i) => [p.code, i]))
  const byDay = new Map<Day, Omit<CourseRun, 'lane' | 'lanes'>[]>()

  for (const course of courses) {
    for (const slot of course.snapshot.time_slots) {
      const indexes = slot.periods
        .map((code) => order.get(code))
        .filter((i): i is number => i !== undefined)
        .sort((a, b) => a - b)

      let start: number | null = null
      let previous: number | null = null

      const flush = () => {
        if (start === null || previous === null) return
        const bucket = byDay.get(slot.day) ?? []
        bucket.push({ course, day: slot.day, start, span: previous - start + 1 })
        byDay.set(slot.day, bucket)
      }

      for (const index of indexes) {
        if (start === null || previous === null) {
          start = index
        } else if (index !== previous + 1) {
          flush()
          start = index
        }
        previous = index
      }
      flush()
    }
  }

  return [...byDay.values()].flatMap(assignLanes)
}

const WEEKDAYS: Day[] = [1, 2, 3, 4, 5]
const WEEKEND: Day[] = [6, 0]

/**
 * 哪幾天要顯示。
 *
 * 週末預設收起來,但**只要有課就一定顯示** —— 設定關著就把週六的課藏起來,
 * 等於課表在說謊。
 */
export function visibleDays(
  courses: readonly SavedCourse[],
  showWeekend: boolean,
): Day[] {
  const used = new Set<Day>()
  for (const course of courses) {
    for (const slot of course.snapshot.time_slots) used.add(slot.day)
  }
  return [...WEEKDAYS, ...WEEKEND.filter((d) => showWeekend || used.has(d))]
}

/** 有衝堂的課號。整塊標紅比只標那一格好認 —— 使用者要知道是哪兩門在撞。 */
export function conflictingCourseIds(grid: Grid): Set<string> {
  const ids = new Set<string>()
  for (const key of grid.conflicts) {
    for (const course of grid.cells.get(key) ?? []) ids.add(course.id)
  }
  return ids
}
