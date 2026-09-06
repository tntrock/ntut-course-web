import type {
  Changes,
  ClassCourses,
  ClassesResponse,
  ClassroomsResponse,
  Course,
  CourseIndex,
  CourseIndexEntry,
  CoursesResponse,
  DepartmentsResponse,
  Meta,
  ProgramsResponse,
  ScheduleResponse,
  SemesterPath,
  Syllabus,
  SyllabusProgress,
  TeacherCourses,
  TeachersResponse,
} from '@/types/api'

/**
 * 資料來源的網址。
 *
 * **匯出出去** —— 關於頁要顯示它。寫死第二份的話,改了環境變數卻忘了改文案,
 * 使用者照著頁面上的網址是打不到東西的。
 */
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? 'https://tntrock.github.io/ntut-course-crawler'
).replace(/\/+$/, '')

const BASE = API_BASE

export class ApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(status: number, path: string) {
    super(`取得 ${path} 失敗（HTTP ${status}）`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

/**
 * 索引裡有這門課,但翻遍它掛的系所檔都找不到完整物件。
 *
 * 與 `ApiError` 分開是因為使用者看到的東西不同:這個要顯示「查無此課」,
 * `ApiError` 要顯示「載入失敗,請重試」。
 */
export class CourseNotFoundError extends Error {
  readonly semester: SemesterPath
  readonly courseId: string

  constructor(semester: SemesterPath, courseId: string) {
    super(`${semester} 找不到課號 ${courseId}`)
    this.name = 'CourseNotFoundError'
    this.semester = semester
    this.courseId = courseId
  }
}

export const API_CACHE_NAME = 'ntut-api-v1'

/**
 * 開啟 API 快取。無痕視窗、舊瀏覽器、或使用者停用網站資料時會拿不到 ——
 * 這時回傳 `null`,呼叫端改走純網路,**功能不能因此壞掉**。
 */
async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(API_CACHE_NAME)
  } catch {
    return null
  }
}

export async function fetchVersioned<T>(path: string, version: string): Promise<T> {
  const url = `${BASE}/${path}?v=${encodeURIComponent(version)}`
  const cache = await openCache()

  const hit = await cache?.match(url)
  if (hit) return (await hit.json()) as T

  const res = await fetch(url)
  if (!res.ok) throw new ApiError(res.status, path)
  if (cache) {
    await cache.put(url, res.clone())
    await evictOtherVersions(cache, url)
  }
  return (await res.json()) as T
}

export interface MetaResult {
  data: Meta
  /**
   * 資料來自離線快取而非網路。為 `true` 時 UI 要顯示離線橫幅,
   * 並用 `data.generated_at` 告訴使用者資料是什麼時候的。
   */
  fromCache: boolean
}

/**
 * 取得 `meta.json`。
 *
 * 這一支**不加版本號、永遠走網路優先** —— 它本身就是其他所有端點的版本來源,
 * 拿舊的會讓整個快取層失去意義。只有 2.4 KB,每次重抓的成本可以接受。
 * 抓不到時退回上次的快取,讓離線也能用。
 */
export async function fetchMeta(): Promise<MetaResult> {
  const url = `${BASE}/meta.json`
  const cache = await openCache()

  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new ApiError(res.status, 'meta.json')
    await cache?.put(url, res.clone())
    return { data: (await res.json()) as Meta, fromCache: false }
  } catch (err) {
    const hit = await cache?.match(url)
    if (hit) return { data: (await hit.json()) as Meta, fromCache: true }
    throw err
  }
}

/**
 * 取得某學期的快取版本號。
 *
 * **舊學期的 `generated_at` 永遠不變**,所以歷史資料只會下載一次,之後永久命中。
 * 找不到學期時直接丟錯 —— 默默改用 `meta.generated_at` 會讓每次 crawler 更新
 * 都把所有歷史資料的快取沖掉。
 */
export function semesterVersion(meta: Meta, semester: SemesterPath): string {
  const entry = meta.semesters.find((s) => s.path === semester)
  if (!entry) throw new Error(`meta.json 裡沒有學期 ${semester}`)
  return entry.generated_at
}

/** 單一學期的輕量索引 —— 搜尋的資料來源。 */
export function fetchSemesterIndex(
  meta: Meta,
  semester: SemesterPath,
): Promise<CourseIndex> {
  return fetchVersioned<CourseIndex>(
    `${semester}/index.json`,
    semesterVersion(meta, semester),
  )
}

/** 學院 / 系所 / 班級三層對照。gzip 約 5 KB。 */
export function fetchDepartments(
  meta: Meta,
  semester: SemesterPath,
): Promise<DepartmentsResponse> {
  return fetchVersioned<DepartmentsResponse>(
    `${semester}/departments.json`,
    semesterVersion(meta, semester),
  )
}

/** 單一系所的完整課程檔。gzip 約 3.6 KB。 */
export function fetchDepartmentCourses(
  meta: Meta,
  semester: SemesterPath,
  departmentId: string,
): Promise<CoursesResponse> {
  return fetchVersioned<CoursesResponse>(
    `${semester}/courses/${departmentId}.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 取得**完整**課程物件 —— 輕量索引沒有 `syllabus_url` / `notes` /
 * `classrooms` / `programs`,詳情頁需要這些。
 *
 * 合開課掛在多個系所底下,實測三個系所檔裡的課程物件完全一致;但那是資料的
 * 巧合而非 API 的承諾,所以第一個找不到就往下試,而不是直接放棄。
 */
export async function fetchCourse(
  meta: Meta,
  semester: SemesterPath,
  entry: CourseIndexEntry,
): Promise<Course> {
  for (const departmentId of entry.department_ids) {
    const response = await fetchDepartmentCourses(meta, semester, departmentId)
    const course = response.courses.find((c) => c.id === entry.id)
    if (course) return course
  }
  throw new CourseNotFoundError(semester, entry.id)
}

/** 教師清單(803 位)。 */
export function fetchTeachers(
  meta: Meta,
  semester: SemesterPath,
): Promise<TeachersResponse> {
  return fetchVersioned<TeachersResponse>(
    `${semester}/teachers.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 單一教師的課表。
 *
 * `teacherId` 是**教師代碼**不是姓名 —— 實測 803 個代碼只有 801 個不同姓名,
 * 林志哲與陳盈竹各有兩位。用姓名會把兩個人的課混在一起。
 */
export function fetchTeacherCourses(
  meta: Meta,
  semester: SemesterPath,
  teacherId: string,
): Promise<TeacherCourses> {
  return fetchVersioned<TeacherCourses>(
    `${semester}/teachers/${encodeURIComponent(teacherId)}.json`,
    semesterVersion(meta, semester),
  )
}

/** 班級清單(293 個)。 */
export function fetchClasses(
  meta: Meta,
  semester: SemesterPath,
): Promise<ClassesResponse> {
  return fetchVersioned<ClassesResponse>(
    `${semester}/classes.json`,
    semesterVersion(meta, semester),
  )
}

/** 單一班級的課表。 */
export function fetchClassCourses(
  meta: Meta,
  semester: SemesterPath,
  classId: string,
): Promise<ClassCourses> {
  return fetchVersioned<ClassCourses>(
    `${semester}/classes/${encodeURIComponent(classId)}.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 學程 → 課號(86 個)。
 *
 * **只有課號沒有課程內容**,要顯示課程得拿課號回索引查(見 `lib/crossref.ts`)。
 * 學程也**沒有代碼**,識別只能用中文名。
 */
export function fetchPrograms(
  meta: Meta,
  semester: SemesterPath,
): Promise<ProgramsResponse> {
  return fetchVersioned<ProgramsResponse>(
    `${semester}/programs.json`,
    semesterVersion(meta, semester),
  )
}

/** 教室 → 課號(234 間)。同 `fetchPrograms`,只有課號。 */
export function fetchClassrooms(
  meta: Meta,
  semester: SemesterPath,
): Promise<ClassroomsResponse> {
  return fetchVersioned<ClassroomsResponse>(
    `${semester}/classrooms.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 星期 × 節次 → 課號。空教室查詢用的。
 *
 * 它與 `classrooms.json` 交叉就能算出某個時段哪些教室沒課 —— 兩個檔案加起來
 * gzip 18 KB,比下載 60 個系所檔便宜兩個數量級。
 */
export function fetchSchedule(
  meta: Meta,
  semester: SemesterPath,
): Promise<ScheduleResponse> {
  return fetchVersioned<ScheduleResponse>(
    `${semester}/schedule.json`,
    semesterVersion(meta, semester),
  )
}

/**
 * 課程與教師的異動事件流。
 *
 * 跨學期,所以版本號用 `meta.generated_at` 而不是某個學期的。
 */
export function fetchChanges(meta: Meta): Promise<Changes> {
  return fetchVersioned<Changes>('changes.json', meta.generated_at)
}

/**
 * 大綱抓取進度。**這是判斷「有沒有大綱」的來源**(見 `lib/syllabus.ts`),
 * 所以詳情頁一定會用到它,不是可有可無的統計資料。
 *
 * 它跨學期,版本號因此用 `meta.generated_at`。
 */
export function fetchSyllabusProgress(meta: Meta): Promise<SyllabusProgress> {
  return fetchVersioned<SyllabusProgress>('syllabus.json', meta.generated_at)
}

/**
 * 單門課的教學大綱。
 *
 * `version` 要傳**該門課在 `syllabus.json` 裡的抓取時間**,不是學期的
 * `generated_at` —— 老師改大綱時學期索引不會重新產生,用學期版本號會讓
 * 修訂過的大綱永遠取到舊的那份。
 */
export function fetchSyllabus(
  semester: SemesterPath,
  courseId: string,
  version: string,
): Promise<Syllabus> {
  return fetchVersioned<Syllabus>(`${semester}/syllabus/${courseId}.json`, version)
}

/**
 * 刪掉同一路徑的其他版本。
 *
 * 沒有這步的話,每次 crawler 更新都會在 Cache Storage 留下一份舊資料,
 * 使用者的配額遲早被吃光。
 */
async function evictOtherVersions(cache: Cache, keepUrl: string): Promise<void> {
  const prefix = keepUrl.split('?')[0]
  if (prefix === undefined) return
  const stale = (await cache.keys()).filter(
    (req) => req.url !== keepUrl && req.url.split('?')[0] === prefix,
  )
  await Promise.all(stale.map((req) => cache.delete(req)))
}
