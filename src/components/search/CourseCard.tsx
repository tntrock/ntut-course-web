import { Link } from '@tanstack/react-router'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { LANGUAGE_ZH } from '@/lib/filters'
import { formatTimeSlots } from '@/lib/formatTime'

function languageLabel(language: string | null): string | null {
  if (language === null || language === LANGUAGE_ZH) return null
  return language
}

/**
 * 徽章分三級。原本四個徽章長得一模一樣,「專業選修」「3 學分」「英語」
 * 「修課 29 人」看起來一樣重要 —— 等於沒有重點。
 *
 * - `strong`:必修。這是選課時最先要判斷的事
 * - `normal`:選修類別、授課語言
 * - `quiet`:學分、人數這種數字,看得到就好
 */
function Badge({
  tone = 'normal',
  children,
}: {
  tone?: 'strong' | 'normal' | 'quiet'
  children: React.ReactNode
}) {
  const styles = {
    strong: 'bg-primary-muted text-primary font-medium',
    normal: 'bg-secondary text-secondary-foreground',
    quiet: 'text-muted-foreground',
  }[tone]

  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap ${styles}`}>
      {children}
    </span>
  )
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
  // 「校訂共同必修」「校訂專業必修」都是必修,「共同選修」「專業選修」不是。
  // required 是三態(null 代表原始欄位空白),所以用它而不是猜字串
  const isRequired = course.required === true

  return (
    <article className="bg-card shadow-card hover:ring-primary/40 h-full rounded-xl transition-shadow hover:shadow-md hover:ring-1">
      <Link
        to="/course/$semester/$courseId"
        params={{ semester, courseId: course.id }}
        className="focus-visible:ring-ring block h-full rounded-xl p-3.5 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          {/*
            課名一律**佔兩行高**,不管實際是一行還是兩行。
            不固定的話多欄網格會排成錯落的磚牆 —— 空間是省了,但每一列的起點
            都對不齊,眼睛得重新找位置,那正是「看起來很亂」的來源。
            超過兩行就截斷,完整課名在詳情頁。
          */}
          <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] leading-snug font-medium">
            {course.name_zh}
          </h3>
          <span className="text-muted-foreground mt-0.5 shrink-0 text-xs tabular-nums">
            {course.id}
          </span>
        </div>

        <p className="text-muted-foreground truncate text-sm">
          {course.teachers.length > 0 ? course.teachers.join('、') : '未定'}
        </p>
        <p className="mt-0.5 truncate text-sm">{formatTimeSlots(course, periods)}</p>

        {/* 徽章也固定一行:換行會讓卡片變高,整列又跟著錯開 */}
        <div className="mt-2.5 flex h-6 items-center gap-1.5 overflow-hidden">
          {course.requirement_type && (
            <Badge tone={isRequired ? 'strong' : 'normal'}>
              {course.requirement_type}
            </Badge>
          )}
          {language && <Badge>{language}</Badge>}
          {course.credits !== null && <Badge tone="quiet">{course.credits} 學分</Badge>}
          {course.enrolled !== null && course.enrolled > 0 && (
            // `enrolled` 是修課人數,不是名額上限 —— 文案不能寫「名額」
            <Badge tone="quiet">修課 {course.enrolled} 人</Badge>
          )}
        </div>
      </Link>
    </article>
  )
}
