import type { DailyEnrollment, EnrollmentSnapshot, SemesterPath } from '@/types/api'

/**
 * 這個學期最近幾天的快照,由新到舊。
 *
 * **一定要先篩學期。** `enrollment.json` 把所有學期的快照放在同一個陣列裡,
 * 不篩就會把 114-2 的人數當成 115-1 的。
 */
export function recentSnapshots(
  snapshots: readonly EnrollmentSnapshot[],
  semester: SemesterPath,
  days: number,
): EnrollmentSnapshot[] {
  return snapshots
    .filter((s) => s.semester === semester)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days)
}

export interface EnrollmentPoint {
  date: string
  enrolled: number
  withdrawn: number
  /**
   * 跟前一天(較舊那筆)相比的修課人數變化。
   * 最舊的一筆沒有可比的對象,是 `null` —— 不是 0。
   */
  change: number | null
}

/**
 * 從逐日快照裡挑出某一門課的人數變化,由新到舊。
 *
 * **那天沒有這門課就跳過,不要當成 0 人。** 加開的課在更早的快照裡根本不存在,
 * 補成 0 會畫成「本來 0 人、突然 40 人」,看起來像全部退光又全部回來。
 */
export function courseSeries(
  dailies: readonly DailyEnrollment[],
  courseId: string,
): EnrollmentPoint[] {
  const rows = dailies
    .map((day) => {
      const hit = day.courses.find((c) => c.id === courseId)
      return hit
        ? { date: day.date, enrolled: hit.enrolled, withdrawn: hit.withdrawn }
        : null
    })
    .filter(
      (row): row is { date: string; enrolled: number; withdrawn: number } =>
        row !== null,
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  return rows.map((row, i) => {
    const older = rows[i + 1]
    return { ...row, change: older ? row.enrolled - older.enrolled : null }
  })
}
