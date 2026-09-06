import { Link } from '@tanstack/react-router'

import { updateStore } from '@/hooks/useStore'
import { formatTimeSlots } from '@/lib/formatTime'
import { refreshSnapshot } from '@/lib/storeActions'
import type { ScheduleChange } from '@/lib/schedule'
import type { SavedCourse } from '@/lib/storage'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'

export interface ChangedEntry {
  course: SavedCourse
  changes: ScheduleChange[]
  current: CourseIndexEntry | undefined
}

function describe(change: ScheduleChange): string {
  switch (change.kind) {
    case 'removed':
      return '此課已停開'
    case 'time':
      return '時段已異動'
    case 'teachers':
      return '授課教師已更換'
    case 'credits':
      return `學分數已異動 ${change.from ?? '—'} → ${change.to ?? '—'}`
  }
}

/**
 * 把 crawler 的異動偵測接到使用者最在乎的地方:他自己那幾門課。
 *
 * 停開的課**留在課表裡但標紅**,不自動移除 —— 替使用者做決定會讓他不知道
 * 自己原本選了什麼。
 */
export function ChangeList({
  entries,
  semester,
  periods,
}: {
  entries: ChangedEntry[]
  semester: string
  /** 判斷節次相不相鄰一定要用 meta 的順序,不然 `7、8` 會被寫成兩段。 */
  periods: readonly PeriodDef[]
}) {
  return (
    <section className="border-warning bg-warning/10 mt-4 rounded-lg border-l-2 px-3 py-2.5">
      <h2 className="text-sm font-medium">{entries.length} 門課有異動</h2>
      <ul className="mt-2 space-y-2">
        {entries.map(({ course, changes, current }) => (
          <li key={course.id} className="text-sm">
            <Link
              to="/course/$semester/$courseId"
              params={{ semester, courseId: course.id }}
              className="font-medium underline underline-offset-4"
            >
              {course.snapshot.name_zh}
            </Link>
            <span className="text-muted-foreground ml-2 text-xs">
              {changes.map(describe).join('、')}
            </span>

            {changes.map((change) =>
              change.kind === 'time' ? (
                <p key="time" className="text-muted-foreground mt-0.5 text-xs">
                  {formatTimeSlots({ time_slots: change.from }, periods)}
                  <span className="mx-1.5">→</span>
                  {formatTimeSlots({ time_slots: change.to }, periods)}
                </p>
              ) : null,
            )}

            {current && (
              <button
                type="button"
                onClick={() =>
                  updateStore((s) => refreshSnapshot(s, semester, course.id, current))
                }
                className="text-primary hover:bg-accent mt-1 rounded-md px-2 py-0.5 text-xs"
              >
                更新為最新資料
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
