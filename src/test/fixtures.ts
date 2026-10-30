import type { Course, CourseIndexEntry } from '@/types/api'
import { course } from './factories'

/**
 * 路由測試共用的假資料。
 *
 * 一個學期(115-1)、一個系(資工系 59)。各測試檔再用 `{ ...BASE_API, ... }`
 * 補上自己那一頁要抓的檔案 —— `stubApi()` 遇到沒準備的請求會直接丟例外。
 */

export const SEMESTER = {
  year: 115,
  sem: 1,
  path: '115-1',
  generated_at: '2026-09-13T00:00:00Z',
  partial: false,
  department_count: 1,
  class_group_count: 1,
  course_count: 1,
  merged_course_count: 0,
  failed_department_count: 0,
}

export const META = {
  schema_version: 3,
  generated_at: '2026-09-13T00:00:00Z',
  latest: '115-1',
  disclaimer: '測試用免責聲明。',
  source: { name: '測試來源', url: 'https://example.invalid/' },
  semesters: [SEMESTER],
  endpoints: [],
  periods: [{ code: '1', start: '08:10', end: '09:00' }],
  requirement_symbols: [],
}

export const ENTRY = course({
  id: '364540',
  name_zh: '網路與系統安全',
  teachers: ['王小明'],
  department_ids: ['59'],
  credits: 3,
})

export const DEPARTMENTS = {
  semester: '115-1',
  departments: [
    {
      id: '59',
      name: '資工系',
      college: '電資學院',
      url: '',
      class_groups: [],
      course_count: 1,
      path: '115-1/courses/59.json',
    },
  ],
  colleges: [{ name: '電資學院', department_ids: ['59'] }],
}

/** 幾乎每一頁都會抓的檔案。 */
export const BASE_API = {
  'meta.json': META,
  'capacity.json': { schema_version: 3, classroom_count: 0, classrooms: {} },
  'enrollment.json': { schema_version: 3, snapshot_count: 0, snapshots: [] },
}

/** 明細頁用的完整課程物件(索引欄位之外的那些)。 */
export function fullCourse(overrides: Partial<CourseIndexEntry> = {}): Course {
  return {
    ...course(overrides),
    name_en: null,
    stage: '1',
    hours: 3,
    classes: [],
    classrooms: [],
    classroom_codes: [],
    quota: null,
    syllabus_url: null,
    notes: null,
    audit: null,
    lab: null,
    programs: [],
  }
}

/** `SemesterScoped` 的那三個欄位。 */
export const SCOPED = { schema_version: 3, year: 115, sem: 1 }
