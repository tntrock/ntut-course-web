import { Link } from '@tanstack/react-router'

import { updateStore } from '@/hooks/useStore'
import { formatTimeSlots } from '@/lib/formatTime'
import { removeFromSchedule } from '@/lib/storeActions'
import type { SavedCourse } from '@/lib/storage'
import type { PeriodDef } from '@/types/api'

export function SavedCourseRow({
  course,
  semester,
  periods,
  conflicted,
}: {
  course: SavedCourse
  semester: string
  periods: readonly PeriodDef[]
  conflicted: boolean
}) {
  return (
    <div
      className={`bg-card shadow-card flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        conflicted ? 'ring-destructive/40 ring-1' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <Link
          to="/course/$semester/$courseId"
          params={{ semester, courseId: course.id }}
          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
        >
          {course.snapshot.name_zh}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {course.snapshot.teachers.join('、') || '未定'}
          <span className="mx-1.5">·</span>
          {formatTimeSlots(course.snapshot, periods)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => updateStore((s) => removeFromSchedule(s, semester, course.id))}
        aria-label={`從課表移除 ${course.snapshot.name_zh}`}
        className="text-muted-foreground hover:bg-accent focus-visible:ring-ring shrink-0 rounded-lg px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        移除
      </button>
    </div>
  )
}
