import type { CourseIndexEntry } from '@/types/api'
import type { SortKey } from './searchParams'

/**
 * 排序。所有排序都以課名、課號作最後的決勝,結果才不會因為來源資料的順序而跳動。
 *
 * `null` 的學分 / 人數一律排到最後 —— 把未知當成 0 會讓它們混在真正是 0 的課裡,
 * 使用者無從分辨。
 */
export function sortCourses<T extends CourseIndexEntry>(
  courses: readonly T[],
  sort: SortKey,
  scores: ReadonlyMap<string, number>,
): T[] {
  const tieBreak = (a: T, b: T) => {
    const byName = a.name_zh.localeCompare(b.name_zh, 'zh-Hant')
    return byName !== 0 ? byName : a.id.localeCompare(b.id)
  }

  /** `null` 視為最小,排到最後。 */
  const desc = (a: number | null, b: number | null) =>
    (b ?? Number.NEGATIVE_INFINITY) - (a ?? Number.NEGATIVE_INFINITY)

  const comparators: Record<SortKey, (a: T, b: T) => number> = {
    relevance: (a, b) => {
      const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
      return diff !== 0 ? diff : tieBreak(a, b)
    },
    name: tieBreak,
    credits: (a, b) => {
      const diff = desc(a.credits, b.credits)
      return diff !== 0 ? diff : tieBreak(a, b)
    },
    enrolled: (a, b) => {
      const diff = desc(a.enrolled, b.enrolled)
      return diff !== 0 ? diff : tieBreak(a, b)
    },
  }

  return [...courses].sort(comparators[sort])
}
