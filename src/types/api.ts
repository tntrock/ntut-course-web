/**
 * ntut-course-crawler 靜態 API 的 TypeScript 型別。
 *
 * 依 `plan.md` §1 手寫,並對線上實際資料逐欄位核對過
 * (base: https://tntrock.github.io/ntut-course-crawler/)。
 *
 * 兩條規則:
 * 1. **只宣告用得到的欄位。** crawler 承諾新增欄位不升 `schema_version`,
 *    所以型別必須容得下沒宣告的欄位 —— 不要用 exact object type,
 *    也不要在 runtime 驗證形狀(見 plan §1.4)。
 * 2. **`null` 是常態,不是例外。** 原始頁面用全形空白表示「沒有這欄」,
 *    crawler 已一律正規化成 `null`(陣列欄位為 `[]`)。
 */

/** 目前支援的 schema 版本。crawler 移除欄位 / 改型別 / 改語意時才會升版。 */
export const SUPPORTED_SCHEMA_VERSION = 3

/** 所有頂層回應共有的欄位。 */
export interface SchemaVersioned {
  schema_version: number
}

/** 學期範圍的回應共有的欄位。`year` 是民國學年,`sem` 是 1 或 2。 */
export interface SemesterScoped extends SchemaVersioned {
  year: number
  sem: number
}

/**
 * 學期字串,例如 `"115-1"`。
 *
 * 注意 `meta.semesters[]` 裡這個值的欄位名是 **`path`**,不是 `semester`。
 */
export type SemesterPath = string

/** 星期。1 = 週一 … 6 = 週六,0 = 週日。 */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * 節次代碼。順序**不是**字典序(`4, N, 5` 與 `9, A, B`),
 * 一律以 `meta.periods` 給的陣列順序為準,不要自己排。
 */
export type PeriodCode = string

// ─────────────────────────────────────────────────────────────
// meta.json
// ─────────────────────────────────────────────────────────────

export interface PeriodDef {
  code: PeriodCode
  /** `"08:10"` */
  start: string
  /** `"09:00"` */
  end: string
}

/**
 * 必選修符號對照。★ 與 ☆ 都是**選修**,差別在共同 / 專業。
 * 篩選 UI 不能只做「必修 / 選修」兩個按鈕。
 */
export interface RequirementSymbol {
  symbol: string
  required: boolean
  requirement_type: string
}

export interface SemesterMeta {
  year: number
  sem: number
  /** 學期字串,例如 `"115-1"` —— 用這個組 API 路徑。 */
  path: SemesterPath
  /**
   * 該學期資料的產生時間。
   *
   * **這是快取版本號的來源**(見 `lib/api.ts`)。舊學期的值永遠不變,
   * 所以歷史資料只會下載一次。
   */
  generated_at: string
  /** 資料是否不完整。目前所有學期皆為 `false`。 */
  partial: boolean
  department_count: number
  class_group_count: number
  course_count: number
  merged_course_count: number
  /** 大於 0 代表有系所抓取失敗,該學期資料可能有缺(plan §7 風險 8)。 */
  failed_department_count: number
}

export interface EndpointDef {
  path: string
  description: string
}

export interface Meta extends SchemaVersioned {
  generated_at: string
  source: { name: string; url: string }
  /** 免責聲明。plan §7 要求**每頁**頁尾顯示。 */
  disclaimer: string
  /** 目前最新學期,例如 `"115-1"`。**絕對不可把學期寫死在前端。** */
  latest: SemesterPath
  /** 由新到舊排序。仍應以 `latest` 為準,不要依賴排序。 */
  semesters: SemesterMeta[]
  endpoints: EndpointDef[]
  periods: PeriodDef[]
  requirement_symbols: RequirementSymbol[]
}

// ─────────────────────────────────────────────────────────────
// 課程
// ─────────────────────────────────────────────────────────────

export interface TimeSlot {
  day: Day
  /** `"一"` … `"六"`。 */
  day_name: string
  periods: PeriodCode[]
}

/**
 * 輕量索引裡的課程。`{semester}/index.json` 的元素,**搜尋的資料來源**。
 *
 * 少了 `syllabus_url` / `notes` / `classrooms` 等欄位 —— 需要那些要抓系所檔
 * (`{semester}/courses/{department_id}.json`)。
 */
export interface CourseIndexEntry {
  /** 課號。**單一學期內唯一,跨學期不穩定。** */
  id: string
  name_zh: string
  /** 顯示用。連結 / 收藏 / 分組一律用 `teacher_codes` —— 確實有同名老師。 */
  teachers: string[]
  teacher_codes: string[]
  /** 可為空陣列(班週會、體育等無固定時段的課)。 */
  time_slots: TimeSlot[]
  department_ids: string[]
  class_ids: string[]
  credits: number | null
  /** 原始欄位空白時是 `null`,**不是 `false`**。篩選時要當第三態。 */
  required: boolean | null
  requirement_type: string | null
  /** `null` = 中文。其餘實測值有 `"英語"`、`"中英雙語"`。**不要當布林用。** */
  language: string | null
  /** **修課人數**,不是名額上限。UI 文案不可寫成「名額」。 */
  enrolled: number | null
  withdrawn: number | null
  year: number
  sem: number
}

/**
 * 完整課程物件。`{semester}/courses/{department_id}.json` 的元素。
 */
export interface Course extends CourseIndexEntry {
  /** 永遠是 `null`(無資料來源)。不要在 UI 上留英文課名的位置。 */
  name_en: null
  /** 年級。 */
  stage: string | null
  hours: number | null
  classes: string[]
  classrooms: string[]
  classroom_codes: string[]
  /**
   * @deprecated `enrolled` 的舊名,值完全相同。一律使用 `enrolled`。
   */
  quota: number | null
  /**
   * 學校教學大綱頁的網址。
   *
   * **`null` 代表這門課沒有大綱** —— 去抓 `{semester}/syllabus/{id}.json`
   * 會拿到 404。前端靠這個欄位判斷要不要顯示大綱分頁,不要靠 404。
   */
  syllabus_url: string | null
  /** 備註,合開資訊在這裡。 */
  notes: string | null
  audit: string | null
  lab: string | null
  programs: string[]
}

export interface DepartmentRef {
  id: string
  name: string
  /** 校級 / 行政單位為 `null`。 */
  college: string | null
  url: string
}

export interface CoursesResponse extends SemesterScoped {
  department: DepartmentRef
  course_count: number
  courses: Course[]
}

export interface CourseIndex extends SemesterScoped {
  course_count: number
  courses: CourseIndexEntry[]
}

// ─────────────────────────────────────────────────────────────
// 瀏覽層
// ─────────────────────────────────────────────────────────────

/** 系所底下的班級。**是物件不是字串** —— plan §1 原本記成 `string[]`。 */
export interface ClassGroupSummary {
  id: string
  name: string
  url: string
}

export interface Department extends DepartmentRef {
  class_groups: ClassGroupSummary[]
  course_count: number
  /** 系所課程檔的路徑,例如 `"115-1/courses/59.json"`。 */
  path: string
}

export interface College {
  /**
   * **`null` 是實測值**,代表教務處 / 體育室 / 通識中心 / 師培中心 / 校院級課程
   * 這 5 個不屬於任何學院的單位。UI 一律顯示成「校級單位」,
   * 絕不可讓 `null` 或空字串跑到畫面上。
   */
  name: string | null
  department_ids: string[]
}

export interface DepartmentsResponse extends SemesterScoped {
  departments: Department[]
  colleges: College[]
}

export interface TeacherSummary {
  /** 教師代碼。**識別以此為準,姓名只用來顯示。** */
  id: string
  name: string
  course_count: number
  department_ids: string[]
  path: string
}

export interface TeachersResponse extends SemesterScoped {
  teacher_count: number
  teachers: TeacherSummary[]
}

export interface TeacherRef {
  id: string
  name: string
  department_ids: string[]
  url: string
}

export interface TeacherCourses extends SemesterScoped {
  teacher: TeacherRef
  course_count: number
  courses: Course[]
}

export interface ClassSummary {
  id: string
  name: string
  department_id: string
  department_name: string
  college: string | null
  course_count: number
  url: string
  path: string
}

export interface ClassesResponse extends SemesterScoped {
  class_count: number
  classes: ClassSummary[]
}

export interface ClassGroupRef {
  id: string
  name: string
  department_id: string
  department_name: string
  college: string | null
  url: string
}

export interface ClassCourses extends SemesterScoped {
  class_group: ClassGroupRef
  course_count: number
  courses: Course[]
}

export interface Program {
  name: string
  course_count: number
  course_ids: string[]
}

export interface ProgramsResponse extends SemesterScoped {
  program_count: number
  programs: Program[]
}

export interface Classroom {
  id: string
  name: string
  course_count: number
  course_ids: string[]
  url: string
}

export interface ClassroomsResponse extends SemesterScoped {
  classroom_count: number
  classrooms: Classroom[]
}

export interface SchedulePeriodBucket {
  code: PeriodCode
  course_count: number
  course_ids: string[]
}

export interface ScheduleDay {
  day: Day
  day_name: string
  periods: SchedulePeriodBucket[]
}

export interface ScheduleResponse extends SemesterScoped {
  periods: PeriodDef[]
  days: ScheduleDay[]
}

// ─────────────────────────────────────────────────────────────
// 教學大綱
// ─────────────────────────────────────────────────────────────

export interface FlexibleLearning {
  category: string[]
  content: string | null
}

/**
 * 單門課的教學大綱。`{semester}/syllabus/{course_id}.json`。
 *
 * **只有 115-1 有大綱**,舊學期一律 404。且 115-1 內也只有約 70% 的課
 * 有 `syllabus_url`,其餘同樣 404 —— 見 `Course.syllabus_url`。
 */
export interface Syllabus extends SemesterScoped {
  course_id: string
  course_name: string
  teachers: string[]
  department_ids: string[]
  /** 學校原始大綱頁,老師沒填時給使用者當退路。 */
  url: string
  /**
   * 本站抓取這份大綱的時間。
   *
   * **schema v3 起,已凍結學期的記錄沒有這個欄位** —— 顯示前一定要判斷。
   */
  fetched_at?: string
  /**
   * 內容雜湊(schema v3 新增,凍結學期才有)。用來判斷內容有沒有變,
   * **不是給使用者看的東西** —— 別讓它跑到畫面上。
   */
  content_hash?: string
  /**
   * 老師是否填了內容。
   *
   * `false` 時下面的內容欄位全空 —— UI 要顯示「授課教師尚未填寫大綱」,
   * 而不是一片空白。
   */
  has_content: boolean
  teacher_name: string | null
  teacher_email: string | null
  /** 老師最後更新大綱的時間。 */
  updated_at: string | null
  outline: string | null
  schedule: string | null
  flexible_learning: FlexibleLearning | null
  assessment: string | null
  materials: string | null
  contact: string[]
  extended_resources: string[]
  sdgs: string[]
  ai_usage: string[]
  notes: string | null
}

/** `syllabus.json` 的 `semesters[]` —— 每個學期的大綱覆蓋率。 */
export interface SyllabusProgressEntry {
  semester: SemesterPath
  /** 已抓取的門數。為 0 代表該學期整個沒有大綱。 */
  fetched: number
  oldest_fetch: string | null
  newest_fetch: string | null
  course_count: number
  /** 有 `syllabus_url` 的門數 —— 覆蓋率的分母是這個,不是 `course_count`。 */
  with_url: number
}

export interface SyllabusProgress extends SchemaVersioned {
  generated_at: string
  semesters: SyllabusProgressEntry[]
  /**
   * 學期 → 課號 → 該門大綱的抓取資訊。**不是數量**(plan §1 原本記成 `number`)。
   *
   * schema v3 把值從**時間字串**改成 `{ at }` 物件。字串型別留著是為了
   * 爬蟲回退版本時不會整頁壞掉 —— 讀取一律經過 `syllabusState()`。
   *
   * 這份對照有兩個用途,兩個都比別的來源準:
   * 1. **存在性** —— 檔案抓到了才會在這裡,所以不必靠 404 判斷有沒有大綱
   * 2. **快取版本號** —— 大綱是獨立於學期索引更新的,拿學期的 `generated_at`
   *    當版本號會讓老師改過的大綱一直取到舊的
   *
   * **只涵蓋還在更新的學期。** 已抓完的學期移到 `frozen`,不再逐課列出。
   */
  fetched: Record<SemesterPath, Record<string, SyllabusFetchInfo | string>>
  /**
   * 已經抓完、不再更新的學期(schema v3 新增)。實測 114-2 / 114-1 / 113-2。
   *
   * 這些學期**不會**出現在 `fetched` 裡 —— 逐課列出六千多筆沒有意義。
   * `fetched === with_url` 代表有大綱連結的課全部抓完了,所以個別課程的存在性
   * 改用 `Course.syllabus_url` 判斷,`at` 則當成整個學期共用的快取版本號。
   */
  frozen?: Record<SemesterPath, FrozenSemester>
}

export interface SyllabusFetchInfo {
  /** 抓取時間。 */
  at: string
}

export interface FrozenSemester {
  fetched: number
  with_url: number
  /** 凍結時間。當作該學期所有大綱的快取版本號。 */
  at: string
}

// ─────────────────────────────────────────────────────────────
// 異動事件流
// ─────────────────────────────────────────────────────────────

export type ChangeEventType =
  'baseline' | 'course_added' | 'course_removed' | 'course_changed' | 'bulk_change'

interface ChangeEventBase {
  at: string
  semester: SemesterPath
  type: ChangeEventType
}

/** 首次建立基準線,不是異動。UI 上要與真正的異動區隔。 */
export interface BaselineEvent extends ChangeEventBase {
  type: 'baseline'
  course_count: number
}

interface CourseEventBase extends ChangeEventBase {
  id: string
  name: string
  teachers: string[]
  department_ids: string[]
  class_ids: string[]
}

export interface CourseAddedEvent extends CourseEventBase {
  type: 'course_added'
}

export interface CourseRemovedEvent extends CourseEventBase {
  type: 'course_removed'
}

/** 單一欄位的前後值。`from` / `to` 的型別隨欄位而異。 */
export interface FieldDiff {
  from: unknown
  to: unknown
}

export interface CourseChangedEvent extends CourseEventBase {
  type: 'course_changed'
  /** 只列出真正變動的欄位。 */
  changes: Record<string, FieldDiff>
}

/**
 * 一次抓取產生大量異動時,crawler 會收斂成單一事件,避免淹掉真正的結構性異動。
 * `by_department` / `by_class` 的 key 是代碼,UI 要轉成中文名。
 */
export interface BulkChangeEvent extends ChangeEventBase {
  type: 'bulk_change'
  event_count: number
  counts: Partial<Record<Exclude<ChangeEventType, 'bulk_change'>, number>>
  by_department: Record<string, number>
  by_class: Record<string, number>
  samples: ChangeEvent[]
  note: string | null
}

export type ChangeEvent =
  | BaselineEvent
  | CourseAddedEvent
  | CourseRemovedEvent
  | CourseChangedEvent
  | BulkChangeEvent

export interface Changes extends SchemaVersioned {
  generated_at: string
  /** 最後一次檢查的時間 —— 超過 12 小時要顯示新鮮度警告。 */
  checked_at: string
  event_count: number
  events: ChangeEvent[]
}

// ─────────────────────────────────────────────────────────────
// 人數快照
// ─────────────────────────────────────────────────────────────

export interface EnrollmentSnapshot {
  semester: SemesterPath
  year: number
  sem: number
  /** `"2026-09-04"` */
  date: string
  at: string
  course_count: number
  enrolled_total: number
  withdrawn_total: number
  path: string
}

export interface Enrollment extends SchemaVersioned {
  generated_at: string
  snapshot_count: number
  snapshots: EnrollmentSnapshot[]
}
