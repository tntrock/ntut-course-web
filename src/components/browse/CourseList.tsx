import { useMemo, useState } from 'react'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { sortCourses } from '@/lib/sort'
import type { SortKey } from '@/lib/searchParams'
import { CourseCard } from '@/components/search/CourseCard'

const EMPTY_SCORES: ReadonlyMap<string, number> = new Map()

/**
 * 明細頁的課程列表。
 *
 * **不做虛擬捲動** —— 明細頁最多的是通識中心的 227 門,和搜尋頁的 2,717 門差一個
 * 數量級。虛擬捲動要固定高度的捲動容器,在一般的頁面捲動裡反而卡手。
 */
export function CourseList({
  courses,
  semester,
  periods,
  empty = '這裡沒有課程。',
}: {
  courses: readonly CourseIndexEntry[]
  semester: string
  periods: readonly PeriodDef[]
  empty?: string
}) {
  // 明細頁沒有查詢字串,相關度排序沒有意義,預設用課名
  const [sort, setSort] = useState<SortKey>('name')
  const sorted = useMemo(
    () => sortCourses(courses, sort, EMPTY_SCORES),
    [courses, sort],
  )

  if (courses.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-16 text-center text-sm">{empty}</p>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b py-2">
        <p className="text-muted-foreground text-sm">
          {courses.length.toLocaleString('zh-TW')} 門課
        </p>
        <select
          name="sort"
          value={sort}
          aria-label="排序"
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-background rounded-lg border px-2 py-1 text-sm"
        >
          <option value="name">課名</option>
          <option value="credits">學分</option>
          <option value="enrolled">修課人數</option>
        </select>
      </div>

      {sorted.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          semester={semester}
          periods={periods}
        />
      ))}
    </div>
  )
}
