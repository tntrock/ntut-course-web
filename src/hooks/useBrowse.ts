import { queryOptions } from '@tanstack/react-query'
import {
  fetchChanges,
  fetchClassCourses,
  fetchClasses,
  fetchClassrooms,
  fetchDepartmentCourses,
  fetchPrograms,
  fetchSchedule,
  fetchTeacherCourses,
  fetchTeachers,
} from '@/lib/api'
import type { Meta, SemesterPath } from '@/types/api'

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
