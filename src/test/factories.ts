import type { CourseIndexEntry, TimeSlot } from '@/types/api'

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
