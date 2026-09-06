import { useLayoutEffect, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { useColumns } from '@/hooks/useColumns'
import { CourseCard } from './CourseCard'

const GAP = 12

/**
 * 搜尋結果。單一學期就有 2,717 筆,全部渲染會讓捲動掉幀,所以仍然虛擬捲動 ——
 * 但改成**跟著整頁的捲軸**而不是自己開一個固定高度的容器。
 *
 * 自己開一個固定高度的容器會讓畫面同時出現兩條捲軸,滑鼠滾輪滾到哪一條要看游標
 * 在哪裡,手機上還會有「捲到列表底部之後整頁才開始動」的頓挫。
 *
 * 多欄則用 `lanes`:寬螢幕下單欄列表左右都是空的,卡片卻擠成一長條。
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
  const listRef = useRef<HTMLDivElement>(null)
  const columns = useColumns()

  /*
   * 列表不是從頁面最頂端開始(上面有頁首與工具列),沒有這個位移的話
   * 捲動位置會整段對不上。
   *
   * 函式庫文件示範的是在 render 期直接讀 `ref.current.offsetTop`,但那樣第一次
   * render 讀到的是 null。改用 `useLayoutEffect` 量測:它在瀏覽器繪製**之前**
   * 跑完,所以不會有看得見的跳動,而且 ref 是在 effect 裡讀的,語意也對。
   *
   * 欄數改變時工具列可能換行、位移跟著變,所以 `columns` 也要進相依陣列。
   */
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0)
  }, [columns])

  // useWindowVirtualizer 回傳的函式無法被 React Compiler memo 化,這是這個
  // 函式庫的已知限制。虛擬捲動的量測本來就必須讀取即時的 DOM 尺寸。
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useWindowVirtualizer({
    count: courses.length,
    estimateSize: () => 128,
    overscan: 6,
    lanes: columns,
    scrollMargin,
  })

  const width = `calc(${(100 / columns).toFixed(4)}% - ${((GAP * (columns - 1)) / columns).toFixed(2)}px)`

  return (
    <div ref={listRef} className="relative w-full">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }} className="relative">
        {virtualizer.getVirtualItems().map((item) => {
          const course = courses[item.index]
          if (!course) return null
          return (
            <div
              key={course.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{
                position: 'absolute',
                top: 0,
                left: `calc(${item.lane} * (${width} + ${GAP}px))`,
                width,
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                paddingBottom: GAP,
              }}
            >
              <CourseCard course={course} semester={semester} periods={periods} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
