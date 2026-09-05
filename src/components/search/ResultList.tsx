import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { CourseCard } from './CourseCard'

/**
 * 虛擬捲動。單一學期就有 2,717 筆,全部渲染會讓捲動掉幀。
 *
 * 卡片高度不固定(教師多、時段多會撐高),所以用 `measureElement` 量實際高度,
 * `estimateSize` 只是初始估計。
 */
export function ResultList({
  courses,
  semester,
  periods,
}: {
  courses: readonly CourseIndexEntry[]
  semester: string
  periods: readonly PeriodDef[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // useVirtualizer 回傳的函式無法被 React Compiler memo 化,這是這個函式庫的
  // 已知限制。虛擬捲動的量測本來就必須讀取即時的 DOM 尺寸。
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: courses.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 108,
    overscan: 8,
  })

  return (
    <div ref={scrollRef} className="h-[calc(100dvh-9rem)] overflow-y-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((item) => {
          const course = courses[item.index]
          if (!course) return null
          return (
            <div
              key={course.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{ transform: `translateY(${item.start}px)` }}
              className="absolute top-0 left-0 w-full"
            >
              <CourseCard course={course} semester={semester} periods={periods} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
