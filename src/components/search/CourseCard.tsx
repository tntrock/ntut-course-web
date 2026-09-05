import { Link } from '@tanstack/react-router'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { LANGUAGE_ZH } from '@/lib/filters'
import { formatTimeSlots } from '@/lib/formatTime'

function languageLabel(language: string | null): string | null {
  if (language === null || language === LANGUAGE_ZH) return null
  return language
}

export function CourseCard({
  course,
  semester,
  periods,
}: {
  course: CourseIndexEntry
  semester: string
  periods: readonly PeriodDef[]
}) {
  const language = languageLabel(course.language)

  return (
    <article className="hover:bg-muted/40 border-b transition-colors">
      <Link
        to="/course/$semester/$courseId"
        params={{ semester, courseId: course.id }}
        className="focus-visible:ring-ring block px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium">{course.name_zh}</h3>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {course.id}
          </span>
        </div>

        <p className="text-muted-foreground mt-1 text-sm">
          {course.teachers.length > 0 ? course.teachers.join('、') : '未定'}
          <span className="mx-1.5">·</span>
          {formatTimeSlots(course, periods)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {course.requirement_type && (
            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
              {course.requirement_type}
            </span>
          )}
          {course.credits !== null && (
            <span className="text-muted-foreground rounded border px-1.5 py-0.5 tabular-nums">
              {course.credits} 學分
            </span>
          )}
          {language && (
            <span className="text-muted-foreground rounded border px-1.5 py-0.5">
              {language}
            </span>
          )}
          {course.enrolled !== null && course.enrolled > 0 && (
            // `enrolled` 是修課人數,不是名額上限 —— 文案不能寫「名額」
            <span className="text-muted-foreground rounded border px-1.5 py-0.5 tabular-nums">
              修課 {course.enrolled} 人
            </span>
          )}
        </div>
      </Link>
    </article>
  )
}
