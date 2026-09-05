import { queryOptions } from '@tanstack/react-query'
import { fetchCourse, fetchSyllabus, fetchSyllabusProgress } from '@/lib/api'
import type { CourseIndexEntry, Meta, SemesterPath } from '@/types/api'

/** 完整課程物件。query key 帶學期版本號,crawler 更新後自然重取。 */
export function courseQueryOptions(
  meta: Meta,
  semester: SemesterPath,
  entry: CourseIndexEntry,
) {
  const version =
    meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'

  return queryOptions({
    queryKey: ['course', semester, entry.id, version],
    queryFn: () => fetchCourse(meta, semester, entry),
    staleTime: Infinity,
  })
}

/**
 * 大綱抓取進度。**每個詳情頁都要**,因為「這門課有沒有大綱」是從它來的。
 *
 * 跨學期共用一份,所以進到第二個詳情頁時已經在快取裡了。
 */
export function syllabusProgressQueryOptions(meta: Meta) {
  return queryOptions({
    queryKey: ['syllabus-progress', meta.generated_at],
    queryFn: () => fetchSyllabusProgress(meta),
    staleTime: Infinity,
  })
}

/** 單門課的大綱。`version` 是該門課的抓取時間(見 `lib/api.ts`)。 */
export function syllabusQueryOptions(
  semester: SemesterPath,
  courseId: string,
  version: string,
) {
  return queryOptions({
    queryKey: ['syllabus', semester, courseId, version],
    queryFn: () => fetchSyllabus(semester, courseId, version),
    staleTime: Infinity,
  })
}
