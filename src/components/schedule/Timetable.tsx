import { Link } from '@tanstack/react-router'
import type { Day, PeriodDef } from '@/types/api'
import { dayName } from '@/lib/formatTime'
import { layoutRuns, type GridItem } from '@/lib/schedule'

export function Timetable({
  items,
  periods,
  semester,
  days,
  conflictKeys,
}: {
  items: readonly GridItem[]
  periods: readonly PeriodDef[]
  semester: string
  days: readonly Day[]
  /** 有衝堂的項目(`course:` / `event:`),用來把整塊標紅。 */
  conflictKeys: ReadonlySet<string>
}) {
  const runs = layoutRuns(items, periods)
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[36rem] gap-px"
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(5rem, 1fr))`,
          gridTemplateRows: `auto repeat(${periods.length}, minmax(2.75rem, auto))`,
        }}
      >
        <div />
        {days.map((day) => (
          <div
            key={day}
            className="text-muted-foreground pb-1 text-center text-xs font-medium"
          >
            週{dayName(day)}
          </div>
        ))}

        {periods.map((period, row) => (
          <div
            key={period.code}
            style={{ gridColumn: 1, gridRow: row + 2 }}
            className="text-muted-foreground flex flex-col justify-center pr-2 text-right"
          >
            <span className="text-sm font-medium">{period.code}</span>
            {/* 節次代碼對排課的人是熟語，對第一次看的人不是 */}
            <span className="text-[10px] tabular-nums">{period.start}</span>
          </div>
        ))}

        {/* 底格。先鋪滿，課再疊上去 —— 空格也要看得出是格子 */}
        {periods.map((period, row) =>
          days.map((day) => (
            <div
              key={`${day}-${period.code}`}
              style={{ gridColumn: (dayIndex.get(day) ?? 0) + 2, gridRow: row + 2 }}
              className="bg-card/60 rounded"
            />
          )),
        )}

        {runs.map((run) => {
          const column = dayIndex.get(run.day)
          // 週末收起來時,那幾天的課不會有欄位可放。`visibleDays` 已保證有課就顯示,
          // 這裡只是不讓它落到錯的欄位
          if (column === undefined) return null

          const conflicted = conflictKeys.has(run.item.key)
          const position = {
            gridColumn: column + 2,
            gridRow: `${run.start + 2} / span ${run.span}`,
            // 同一時段有多個時並排。網格本身不能再細分,所以用
            // 寬度與左邊距把一欄切成幾份
            width: `${(100 / run.lanes).toFixed(3)}%`,
            marginLeft: `${((run.lane * 100) / run.lanes).toFixed(3)}%`,
          }
          const shape = 'overflow-hidden rounded p-1.5 text-xs leading-tight'

          /*
           * 個人事務**不是連結** —— 它沒有課程頁可以去。做成可點的樣子
           * 卻點不動比不可點更糟。
           *
           * 虛線邊框是刻意的:衝堂標紅之後,事務與課程的底色會一樣,
           * 只剩形狀能區分「這是我自己加的」與「這是學校的課」。
           */
          if (run.item.kind === 'event') {
            const { event } = run.item
            return (
              <div
                key={`${run.item.key}-${run.day}-${run.start}`}
                style={position}
                className={`${shape} border border-dashed ${
                  conflicted
                    ? 'bg-destructive/15 text-destructive border-destructive/50'
                    : 'bg-secondary text-muted-foreground border-border'
                }`}
              >
                <span className="line-clamp-3 font-medium">{event.title}</span>
                {event.note && (
                  <span className="mt-0.5 block opacity-75">{event.note}</span>
                )}
              </div>
            )
          }

          const { course } = run.item
          const classroom = course.snapshot.classrooms[0]

          return (
            <Link
              key={`${run.item.key}-${run.day}-${run.start}`}
              to="/course/$semester/$courseId"
              params={{ semester, courseId: course.id }}
              style={position}
              className={`${shape} focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                conflicted
                  ? 'bg-destructive/15 text-destructive ring-destructive/40 ring-1'
                  : 'bg-primary-muted text-primary'
              }`}
            >
              <span className="line-clamp-3 font-medium">
                {course.snapshot.name_zh}
              </span>
              {classroom && (
                <span className="mt-0.5 block opacity-75">{classroom}</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
