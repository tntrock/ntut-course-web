import type { ChangeEvent, SemesterPath } from '@/types/api'
import { hoursSince, taipeiDate } from './datetime'

/** 超過這麼久沒檢查就變成警告色。 */
const STALE_HOURS = 12

export interface DayGroup {
  /** 台北時區的 `YYYY-MM-DD`。 */
  date: string
  events: ChangeEvent[]
}

/**
 * 依台北日期分組,新的在前。
 *
 * **一定要用台北日期**:UTC 傍晚的事件在台北已經是隔天,直接切 ISO 字串會分錯天。
 */
export function groupByDate(events: readonly ChangeEvent[]): DayGroup[] {
  const buckets = new Map<string, ChangeEvent[]>()

  for (const event of events) {
    const date = taipeiDate(event.at)
    const bucket = buckets.get(date)
    if (bucket) bucket.push(event)
    else buckets.set(date, [event])
  }

  return [...buckets.entries()]
    .map(([date, group]) => ({
      date,
      // 同一天也由新到舊,順序才不會跟著來源檔的排列跳動
      events: [...group].sort((a, b) => b.at.localeCompare(a.at)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 資料是不是太久沒更新。
 *
 * 這一條要分清楚兩件事:**`checked_at` 是今天但沒有新事件 = 學校真的沒動;
 * `checked_at` 停在幾天前 = 爬蟲沒在跑。** 使用者看到「近期無異動」時,
 * 得知道是哪一種。
 */
export function isStale(checkedAt: string, now: Date = new Date()): boolean {
  return hoursSince(checkedAt, now) >= STALE_HOURS
}

/**
 * 哪些學期需要把代碼翻成中文名。
 *
 * `baseline` 只有課程數,沒有任何代碼 —— 為它多打 departments / classes 兩個請求
 * 是白費。實測 15 筆事件裡有 12 筆是 baseline,橫跨 7 個學期,不篩的話等於多打
 * 十幾個請求。
 */
export function semestersNeedingNames(
  events: readonly ChangeEvent[],
): SemesterPath[] {
  const semesters = new Set<SemesterPath>()
  for (const event of events) {
    if (event.type === 'baseline') continue
    semesters.add(event.semester)
  }
  return [...semesters]
}

/** `course_changed.changes` 的欄位名。認不得的原樣顯示。 */
const FIELD_LABELS: Record<string, string> = {
  name_zh: '課程名稱',
  teachers: '授課教師',
  teacher_codes: '教師代碼',
  time_slots: '時段',
  department_ids: '開課系所',
  class_ids: '班級',
  classrooms: '教室',
  credits: '學分',
  hours: '時數',
  required: '必選修',
  requirement_type: '必選修類別',
  language: '授課語言',
  enrolled: '修課人數',
  withdrawn: '撤選人數',
  stage: '年級',
  notes: '備註',
  programs: '學程',
}

/**
 * 欄位的中文名。
 *
 * **認不得的欄位原樣顯示,不要藏起來** —— 藏起來的話,crawler 新增偵測欄位時
 * 我們永遠不會發現。
 */
export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

export interface NameLookup {
  department: (id: string) => string
  classGroup: (id: string) => string
}

/** 這些欄位裝的是代碼,直接顯示對使用者毫無意義。 */
const CODE_FIELDS: Record<string, keyof NameLookup> = {
  department_ids: 'department',
  class_ids: 'classGroup',
}

/**
 * 把差異的值變成看得懂的字。
 *
 * 空值顯示成「無」而不是空字串 —— 空字串會讓「舊 → 新」渲染成「 → 電子系」,
 * 看起來像畫面壞掉。
 */
export function formatFieldValue(
  key: string,
  value: unknown,
  names: NameLookup,
): string {
  if (value === null || value === undefined) return '無'

  if (Array.isArray(value)) {
    if (value.length === 0) return '無'

    const lookup = CODE_FIELDS[key]
    if (lookup) {
      return value.map((item) => names[lookup](String(item))).join('、')
    }

    // 物件陣列(時段那種)沒有通用的說法,退回 JSON 也好過 [object Object]
    if (value.some((item) => typeof item === 'object' && item !== null)) {
      return JSON.stringify(value)
    }
    return value.map((item) => String(item)).join('、')
  }

  if (typeof value === 'object') return JSON.stringify(value)
  if (value === '') return '無'
  return String(value)
}

export interface BulkGroup {
  id: string
  name: string
  count: number
}

/**
 * `bulk_change` 的分組統計,由多到少。
 *
 * 只取前幾筆:`by_class` 實測有 11 個,但沒有上限保證 —— 全列出來會淹掉整張卡片。
 */
export function bulkBreakdown(
  counts: Record<string, number>,
  translate: (id: string) => string,
  limit = 20,
): BulkGroup[] {
  return Object.entries(counts)
    .map(([id, count]) => ({ id, name: translate(id), count }))
    // 數量相同時照代碼排,順序才不會每次 render 都不一樣
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit)
}
