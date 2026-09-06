import type { Day, PeriodDef } from '@/types/api'
import type { SavedCourse } from '@/lib/storage'
import { layoutRuns, scheduleStats, visibleDays } from '@/lib/schedule'
import { formatTaipei } from '@/lib/datetime'

/**
 * 匯出用的課表版面。
 *
 * 三個刻意的決定:
 *
 * 1. **固定寬度 1200px**,不跟著視窗。匯出的圖在手機和桌機上要長得一樣。
 * 2. **一律淺色、寫死十六進位色**,不吃站上的深色主題與 CSS 變數。截圖工具是把
 *    computed style 塞進 SVG,顏色函式與變數在那條路徑上是額外的風險 ——
 *    而且分享出去的課表是淺色比較好讀、好印。
 * 3. **不用 webfont**,全站中文本來就走系統字型堆疊。字型嵌不進去的話,
 *    中文會整片變成豆腐(plan §3.5 的已知風險)。
 */

const DAY_NAMES: Record<number, string> = {
  0: '日',
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
}

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"

const INK = '#17181c'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'
const CARD = '#eaf1fd'
const CARD_INK = '#0b66d6'
const CLASH = '#fdeceb'
const CLASH_INK = '#c0332a'

export function ExportImage({
  courses,
  periods,
  semester,
  showWeekend,
  conflictIds,
}: {
  courses: readonly SavedCourse[]
  periods: readonly PeriodDef[]
  semester: string
  showWeekend: boolean
  conflictIds: ReadonlySet<string>
}) {
  const days: Day[] = visibleDays(courses, showWeekend)
  const runs = layoutRuns(courses, periods)
  const stats = scheduleStats(courses, periods)
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  return (
    <div
      style={{
        width: 1200,
        padding: 32,
        background: '#ffffff',
        color: INK,
        fontFamily: FONT,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}
      >
        <span style={{ fontSize: 26, fontWeight: 700 }}>{semester} 課表</span>
        <span style={{ fontSize: 15, color: MUTED }}>
          {stats.courseCount} 門 · {stats.totalCredits} 學分
        </span>
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px' }}>
        產生於 {formatTaipei(new Date().toISOString())}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `64px repeat(${days.length}, 1fr)`,
          gridTemplateRows: `28px repeat(${periods.length}, 46px)`,
          gap: 2,
        }}
      >
        <div />
        {days.map((day) => (
          <div
            key={day}
            style={{ fontSize: 13, color: MUTED, textAlign: 'center', fontWeight: 600 }}
          >
            週{DAY_NAMES[day]}
          </div>
        ))}

        {periods.map((period, row) => (
          <div
            key={period.code}
            style={{
              gridColumn: 1,
              gridRow: row + 2,
              fontSize: 12,
              color: MUTED,
              textAlign: 'right',
              paddingRight: 8,
              lineHeight: 1.2,
            }}
          >
            <div style={{ fontWeight: 600, color: INK }}>{period.code}</div>
            <div style={{ fontSize: 10 }}>{period.start}</div>
          </div>
        ))}

        {periods.map((period, row) =>
          days.map((day) => (
            <div
              key={`${day}-${period.code}`}
              style={{
                gridColumn: (dayIndex.get(day) ?? 0) + 2,
                gridRow: row + 2,
                background: '#f8fafc',
                border: `1px solid ${LINE}`,
                borderRadius: 4,
              }}
            />
          )),
        )}

        {runs.map((run) => {
          const column = dayIndex.get(run.day)
          if (column === undefined) return null
          const clash = conflictIds.has(run.course.id)

          return (
            <div
              key={`${run.course.id}-${run.day}-${run.start}`}
              style={{
                gridColumn: column + 2,
                gridRow: `${run.start + 2} / span ${run.span}`,
                width: `${(100 / run.lanes).toFixed(3)}%`,
                marginLeft: `${((run.lane * 100) / run.lanes).toFixed(3)}%`,
                background: clash ? CLASH : CARD,
                color: clash ? CLASH_INK : CARD_INK,
                border: `1px solid ${clash ? CLASH_INK : CARD_INK}33`,
                borderRadius: 4,
                padding: 6,
                fontSize: 12,
                lineHeight: 1.25,
                overflow: 'hidden',
              }}
            >
              <div style={{ fontWeight: 600 }}>{run.course.snapshot.name_zh}</div>
              {run.course.snapshot.classrooms[0] && (
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  {run.course.snapshot.classrooms[0]}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 沒有固定時段的課不能只留在格子外 —— 匯出的圖同樣不能讓它消失 */}
      {courses.some((c) => c.snapshot.time_slots.length === 0) && (
        <div style={{ marginTop: 16, fontSize: 12 }}>
          <span style={{ color: MUTED }}>未排入時段：</span>
          {courses
            .filter((c) => c.snapshot.time_slots.length === 0)
            .map((c) => c.snapshot.name_zh)
            .join('、')}
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 11, color: MUTED }}>
        北科課程 ntut-course.allenyen.net · 非官方網站，一切以學校公告為準
      </p>
    </div>
  )
}
