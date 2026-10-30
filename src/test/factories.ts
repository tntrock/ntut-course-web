import type { CourseIndexEntry, PeriodDef, TimeSlot } from '@/types/api'
import type { SavedCourse } from '@/lib/storage'
import { toSnapshot } from '@/lib/schedule'

/**
 * 測試用的課程建構器。
 *
 * 預設值刻意貼近實測資料:`language` 是 `null`(中文,佔 81.6%)、
 * `time_slots` 可以是空陣列(班週會之類,實測 249 門)。
 */
export function course(overrides: Partial<CourseIndexEntry> = {}): CourseIndexEntry {
  return {
    id: '360000',
    name_zh: '測試課程',
    teachers: [],
    teacher_codes: [],
    time_slots: [],
    department_ids: [],
    class_ids: [],
    credits: 3,
    required: false,
    requirement_type: '專業選修',
    language: null,
    enrolled: 0,
    withdrawn: 0,
    year: 115,
    sem: 1,
    ...overrides,
  }
}

/** `{ day: 5, periods: ['2','3','4'] }` 這種時段。 */
export function slot(day: number, ...periods: string[]): TimeSlot {
  const names = ['日', '一', '二', '三', '四', '五', '六']
  return {
    day: day as TimeSlot['day'],
    day_name: names[day] ?? '',
    periods,
  }
}

/**
 * 存在課表裡的課 —— 快照從 `course()` 轉出來,跟正式加入課表的路徑一樣。
 *
 * 教室不在索引裡(另外補進快照),所以單獨給。
 */
export function savedCourse({
  classrooms = [],
  ...overrides
}: Partial<CourseIndexEntry> & { classrooms?: string[] } = {}): SavedCourse {
  const entry = course(overrides)
  return {
    id: entry.id,
    addedAt: '2026-09-01T00:00:00.000Z',
    snapshot: { ...toSnapshot(entry), classrooms },
  }
}

/** 第 1–4 節。順序就是 `meta.periods` 的順序。 */
export const PERIODS: PeriodDef[] = [
  { code: '1', start: '08:10', end: '09:00' },
  { code: '2', start: '09:10', end: '10:00' },
  { code: '3', start: '10:10', end: '11:00' },
  { code: '4', start: '11:10', end: '12:00' },
]
