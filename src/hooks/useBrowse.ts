import { queryOptions } from '@tanstack/react-query'
import {
  fetchCapacity,
  fetchChanges,
  fetchDailyEnrollment,
  fetchEnrollmentIndex,
  fetchClassCourses,
  fetchClasses,
  fetchClassrooms,
  fetchDepartmentCourses,
  fetchPrograms,
  fetchSchedule,
  fetchTeacherCourses,
  fetchTeacherCoursesInRange,
  fetchTeachers,
} from '@/lib/api'
import type { EnrollmentSnapshot, Meta, SemesterPath } from '@/types/api'

/**
 * 學期的資料版本。舊學期的 `generated_at` 永遠不變,所以歷史資料只下載一次,
 * 之後永久命中快取。
 */
function version(meta: Meta, semester: SemesterPath): string {
  return meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'
}

export function teachersQueryOptions(meta: Meta, semester: SemesterPath) {
  return queryOptions({
    queryKey: ['teachers', semester, version(meta, semester)],
    queryFn: () => fetchTeachers(meta, semester),
    staleTime: Infinity,
  })
}

export function classesQueryOptions(meta: Meta, semester: SemesterPath) {
  return queryOptions({
    queryKey: ['classes', semester, version(meta, semester)],
    queryFn: () => fetchClasses(meta, semester),
    staleTime: Infinity,
  })
}

export function programsQueryOptions(meta: Meta, semester: SemesterPath) {
  return queryOptions({
    queryKey: ['programs', semester, version(meta, semester)],
    queryFn: () => fetchPrograms(meta, semester),
    staleTime: Infinity,
  })
}

export function classroomsQueryOptions(meta: Meta, semester: SemesterPath) {
  return queryOptions({
    queryKey: ['classrooms', semester, version(meta, semester)],
    queryFn: () => fetchClassrooms(meta, semester),
    staleTime: Infinity,
  })
}

/**
 * 一位老師跨多個學期的課。
 *
 * 包成**一支** query 而不是每學期一支:`fetchTeacherCoursesInRange` 內部會
 * 容忍缺漏的學期,包成一支之後呼叫端不必自己處理「有些成功、有些 404」。
 * 每個檔案仍然各自走版本化的 Cache Storage,所以逐學期的磁碟快取還在。
 */
export function teacherRangeQueryOptions(
  meta: Meta,
  semesters: readonly SemesterPath[],
  teacherId: string,
) {
  return queryOptions({
    queryKey: [
      'teacher-range',
      teacherId,
      semesters.join(','),
      version(meta, semesters[0] ?? ''),
    ],
    queryFn: () => fetchTeacherCoursesInRange(meta, semesters, teacherId),
    staleTime: Infinity,
  })
}

export function teacherCoursesQueryOptions(
  meta: Meta,
  semester: SemesterPath,
  teacherId: string,
) {
  return queryOptions({
    queryKey: ['teacher-courses', semester, teacherId, version(meta, semester)],
    queryFn: () => fetchTeacherCourses(meta, semester, teacherId),
    staleTime: Infinity,
  })
}

export function classCoursesQueryOptions(
  meta: Meta,
  semester: SemesterPath,
  classId: string,
) {
  return queryOptions({
    queryKey: ['class-courses', semester, classId, version(meta, semester)],
    queryFn: () => fetchClassCourses(meta, semester, classId),
    staleTime: Infinity,
  })
}

/** 系所沒有專屬的明細檔 —— 系所課表就是 `courses/{id}.json`。 */
export function departmentCoursesQueryOptions(
  meta: Meta,
  semester: SemesterPath,
  departmentId: string,
) {
  return queryOptions({
    queryKey: ['department-courses', semester, departmentId, version(meta, semester)],
    queryFn: () => fetchDepartmentCourses(meta, semester, departmentId),
    staleTime: Infinity,
  })
}

/** 異動事件流。跨學期,版本號用 `meta.generated_at`。 */
export function enrollmentIndexQueryOptions(meta: Meta) {
  return queryOptions({
    queryKey: ['enrollment-index', meta.generated_at],
    queryFn: () => fetchEnrollmentIndex(meta),
    staleTime: Infinity,
  })
}

/**
 * 某一門課最近幾天的人數。
 *
 * 一次把需要的那幾天包成**一支** query:每天 gzip 約 11 KB,七天 78 KB,
 * 而且過去的日子永遠不變,下載一次就不會再動。
 */
export function courseEnrollmentQueryOptions(
  semester: SemesterPath,
  snapshots: readonly EnrollmentSnapshot[],
) {
  return queryOptions({
    queryKey: ['enrollment-days', semester, snapshots.map((s) => s.at).join(',')],
    queryFn: () =>
      Promise.all(snapshots.map((s) => fetchDailyEnrollment(semester, s.date, s.at))),
    staleTime: Infinity,
  })
}

export function changesQueryOptions(meta: Meta) {
  return queryOptions({
    queryKey: ['changes', meta.generated_at],
    queryFn: () => fetchChanges(meta),
    staleTime: Infinity,
  })
}

/** 星期 × 節次 → 課號。空教室查詢用,見 `lib/rooms.ts`。 */
export function scheduleQueryOptions(meta: Meta, semester: SemesterPath) {
  return queryOptions({
    queryKey: ['schedule', semester, version(meta, semester)],
    queryFn: () => fetchSchedule(meta, semester),
    staleTime: Infinity,
  })
}

/** 教室容量。跨學期共用,所以不帶學期。 */
export function capacityQueryOptions(meta: Meta) {
  return queryOptions({
    queryKey: ['capacity', meta.generated_at],
    queryFn: () => fetchCapacity(meta),
    staleTime: Infinity,
  })
}
