import { useMemo, useState } from 'react'

import { CourseCard } from '@/components/search/CourseCard'
import { COURSE_GRID_CLASS } from '@/hooks/useColumns'
import { useCourseCapacity } from '@/hooks/useCourseCapacity'
import { useMeta } from '@/hooks/useMeta'
import { sortCourses } from '@/lib/sort'
import type { SortKey } from '@/lib/searchParams'
import type { CourseIndexEntry, PeriodDef, SemesterPath } from '@/types/api'

const EMPTY_SCORES: ReadonlyMap<string, number> = new Map()

export interface SemesterCourses {
  semester: SemesterPath
  courses: readonly CourseIndexEntry[]
}

/**
 * 一位老師跨多個學期的課,**按學期分段**。
 *
 * 為什麼要分段而不是混成一份清單:同一位老師常常每年開同一門課
 * (實測陳彥璋六個學期 19 門,課名一直重複),混在一起看不出哪年開了什麼,
 * 而且每張卡片都得重複標年份 —— 卡片本來就擠。分段之後年份只寫在段落標題,
 * 一眼就看得出這位老師這幾年的軌跡。
 *
 * 排序只有**一個**下拉:六段各自一個排序框會變成一排重複的控制項。
 */
export function TeacherCourseGroups({
  groups,
  periods,
}: {
  groups: readonly SemesterCourses[]
  periods: readonly PeriodDef[]
}) {
  const [sort, setSort] = useState<SortKey>('name')
  const total = groups.reduce((n, g) => n + g.courses.length, 0)
  /*
   * 只有一個學期時就照原本的樣子:標題寫學期、段落標題收起來。
   * 「1 個學期」是廢話,而只有一段的段落標題只是把同一個學期寫兩遍 ——
   * 從瀏覽頁、課程頁進來的人看到的應該跟以前一模一樣。
   */
  const single = groups.length === 1 ? groups[0] : undefined

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground tabular-nums">
            {single ? single.semester : `${groups.length} 個學期`}
          </span>
          <span className="text-muted-foreground mx-1.5">·</span>
          <span className="font-medium tabular-nums">
            {total.toLocaleString('zh-TW')}
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

      <div className="space-y-6">
        {groups.map((group) => (
          <SemesterSection
            key={group.semester}
            group={group}
            sort={sort}
            periods={periods}
            showHeading={single === undefined}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 一個學期一段。
 *
 * 拆成獨立元件是因為**教室容量是逐學期的**(`classrooms.json` 每學期一份),
 * hook 不能在迴圈裡呼叫 —— 每一段自己是一個元件才叫得到。
 */
function SemesterSection({
  group,
  sort,
  periods,
  showHeading,
}: {
  group: SemesterCourses
  sort: SortKey
  periods: readonly PeriodDef[]
  showHeading: boolean
}) {
  const { data: meta } = useMeta()
  const capacity = useCourseCapacity(meta, group.semester)
  const sorted = useMemo(
    () => sortCourses(group.courses, sort, EMPTY_SCORES),
    [group.courses, sort],
  )

  return (
    <section>
      {showHeading && (
        <h2 className="text-muted-foreground mb-1.5 flex items-baseline gap-2 text-xs font-medium">
          <span className="tabular-nums">{group.semester}</span>
          <span className="font-normal tabular-nums">{group.courses.length} 門</span>
        </h2>
      )}
      <div className={COURSE_GRID_CLASS}>
        {sorted.map((course) => (
          <CourseCard
            key={course.id}
            seats={capacity.get(course.id)}
            course={course}
            semester={group.semester}
            periods={periods}
          />
        ))}
      </div>
    </section>
  )
}
