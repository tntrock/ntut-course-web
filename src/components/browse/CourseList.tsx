import { useMemo, useState } from 'react'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { sortCourses } from '@/lib/sort'
import type { SortKey } from '@/lib/searchParams'
import { COURSE_GRID_CLASS } from '@/hooks/useColumns'
import { CourseCard } from '@/components/search/CourseCard'

const EMPTY_SCORES: ReadonlyMap<string, number> = new Map()

/**
 * 明細頁的課程列表。版面與搜尋結果一致 —— 同樣的卡片、同樣的多欄網格。
 *
 * **不做虛擬捲動** —— 明細頁最多的是通識中心的 227 門,和搜尋頁的 2,717 門差一個
 * 數量級。這個量直接用 CSS grid 排就好,不必為了它再引入一個量測與定位的機制。
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium tabular-nums">
            {courses.length.toLocaleString('zh-TW')}
          </span>
          <span className="text-muted-foreground"> 門課</span>
        </p>
        <select
          name="sort"
          value={sort}
          aria-label="排序"
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-card rounded-lg border px-2 py-1.5 text-sm"
        >
          <option value="name">課名</option>
          <option value="credits">學分</option>
          <option value="enrolled">修課人數</option>
        </select>
      </div>

      <div className={COURSE_GRID_CLASS}>
        {sorted.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            semester={semester}
            periods={periods}
          />
        ))}
      </div>
    </div>
  )
}
