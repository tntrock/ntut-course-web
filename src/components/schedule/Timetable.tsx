import { Link } from '@tanstack/react-router'
import type { Day, PeriodDef } from '@/types/api'
import type { SavedCourse } from '@/lib/storage'
import { dayName } from '@/lib/formatTime'
import { layoutRuns } from '@/lib/schedule'

export function Timetable({
  courses,
  periods,
  semester,
  days,
  conflictIds,
}: {
  courses: readonly SavedCourse[]
  periods: readonly PeriodDef[]
  semester: string
  days: readonly Day[]
  /** 有衝堂的課號,用來把整塊標紅。 */
  conflictIds: ReadonlySet<string>
}) {
  const runs = layoutRuns(courses, periods)
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

          const conflicted = conflictIds.has(run.course.id)
          const classroom = run.course.snapshot.classrooms[0]

          return (
            <Link
              key={`${run.course.id}-${run.day}-${run.start}`}
              to="/course/$semester/$courseId"
              params={{ semester, courseId: run.course.id }}
              style={{
                gridColumn: column + 2,
                gridRow: `${run.start + 2} / span ${run.span}`,
                // 同一時段有多門課時並排。網格本身不能再細分,所以用
                // 寬度與左邊距把一欄切成幾份
                width: `${(100 / run.lanes).toFixed(3)}%`,
                marginLeft: `${((run.lane * 100) / run.lanes).toFixed(3)}%`,
              }}
              className={`focus-visible:ring-ring overflow-hidden rounded p-1.5 text-xs leading-tight focus-visible:ring-2 focus-visible:outline-none ${
                conflicted
                  ? 'bg-destructive/15 text-destructive ring-destructive/40 ring-1'
                  : 'bg-primary-muted text-primary'
              }`}
            >
              <span className="line-clamp-3 font-medium">
                {run.course.snapshot.name_zh}
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
