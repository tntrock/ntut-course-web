import { useMemo, useState } from 'react'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { sortCourses } from '@/lib/sort'
import type { SortKey } from '@/lib/searchParams'
import { COURSE_GRID_CLASS } from '@/hooks/useColumns'
import { CourseCard } from '@/components/search/CourseCard'
import { useCourseCapacity } from '@/hooks/useCourseCapacity'
import { useMeta } from '@/hooks/useMeta'

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
  const { data: meta } = useMeta()
  const capacity = useCourseCapacity(meta, semester)

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
          {/*
            **學期要標在卡片上方。** 明細頁一次只看一個學期,但頁面上原本沒有
            任何地方寫出那是哪一個 —— 從退選率頁點進來特別容易搞混:那一頁彙總
            好幾個學期,連結會把人帶到這位老師最近有開課的學期(可能是 114-1
            而不是本學期),落地之後卻看不出來。

            標在這裡而不是每張卡片上:同一頁的課都是同一個學期,每張卡片各寫
            一次是重複,而卡片本來就擠。
          */}
          <span className="text-muted-foreground tabular-nums">{semester}</span>
          <span className="text-muted-foreground mx-1.5">·</span>
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
          className="bg-card border-input rounded-lg border px-2 py-1.5 text-sm"
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
            seats={capacity.get(course.id)}
            course={course}
            semester={semester}
            periods={periods}
          />
        ))}
      </div>
    </div>
  )
}
