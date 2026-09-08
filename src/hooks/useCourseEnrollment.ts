import { useQuery } from '@tanstack/react-query'

import {
  courseEnrollmentQueryOptions,
  enrollmentIndexQueryOptions,
} from '@/hooks/useBrowse'
import { courseSeries, recentSnapshots, type EnrollmentPoint } from '@/lib/enrollment'
import type { Meta, SemesterPath } from '@/types/api'

/** 最多看幾天。 */
const DAYS = 7

/**
 * 一門課近幾天的人數變化。
 *
 * **不擋整頁渲染。** 這是課程資訊底下的一小塊附註,為了它讓整頁空白不划算,
 * 所以兩支查詢都用非 suspense 的 `useQuery`,還沒到就先回空陣列。
 *
 * 成本:索引一支,加上每天一份逐課快照(gzip 約 11 KB),七天約 78 KB。
 * 過去的日子寫下去就不會再改(版本號用快照自己的 `at`),所以只會下載一次。
 */
export function useCourseEnrollment(
  meta: Meta,
  semester: SemesterPath,
  courseId: string,
): EnrollmentPoint[] {
  const index = useQuery(enrollmentIndexQueryOptions(meta)).data
  const snapshots = index ? recentSnapshots(index.snapshots, semester, DAYS) : []

  const days = useQuery({
    ...courseEnrollmentQueryOptions(semester, snapshots),
    enabled: snapshots.length > 0,
  }).data

  return days ? courseSeries(days, courseId) : []
}
