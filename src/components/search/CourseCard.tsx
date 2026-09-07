import { Link } from '@tanstack/react-router'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import { hasEnrolment } from '@/lib/course'
import { LANGUAGE_ZH } from '@/lib/filters'
import { formatTimeSlots } from '@/lib/formatTime'
import { Badge } from '@/components/ui/Badge'
import { ScheduleToggle } from '@/components/ScheduleToggle'

function languageLabel(language: string | null): string | null {
  if (language === null || language === LANGUAGE_ZH) return null
  return language
}

export function CourseCard({
  course,
  semester,
  periods,
  seats,
}: {
  course: CourseIndexEntry
  semester: string
  periods: readonly PeriodDef[]
  /** 教室容量。查不到就不顯示 —— 約有一半的課沒有登記教室或學校沒填座位數。 */
  seats?: number | undefined
}) {
  const language = languageLabel(course.language)
  // 「校訂共同必修」「校訂專業必修」都是必修,「共同選修」「專業選修」不是。
  // required 是三態(null 代表原始欄位空白),所以用它而不是猜字串
  const isRequired = course.required === true

  /*
   * **卡片在多欄時固定高度,單欄時不固定。**
   *
   * 多欄(≥ sm,見 `useColumns`)要固定,否則徽章一行或兩行會讓同一列的卡片
   * 高低錯開;多出來的空間用 `mt-auto` 推到時段與徽章之間,讀起來像段落間距,
   * 全部堆在最底下才會像沒做完。
   *
   * 單欄時左右沒有鄰居可以對齊,固定高度只是讓每張卡片白白多佔 40px ——
   * 手機上捲一頁就差好幾張卡。所以改成順著內容長。
   */
  return (
    <article className="bg-card shadow-card hover:ring-primary/40 relative rounded-xl transition-shadow hover:shadow-md hover:ring-1 sm:h-[10.5rem]">
      <Link
        to="/course/$semester/$courseId"
        params={{ semester, courseId: course.id }}
        className="focus-visible:ring-ring flex h-full flex-col rounded-xl p-3.5 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          {/*
            課名一律**佔兩行高**，不管實際是一行還是兩行。
            不固定的話多欄網格會排成錯落的磚牆 —— 空間是省了，但每一列的起點
            都對不齊，眼睛得重新找位置，那正是「看起來很亂」的來源。
            超過兩行就截斷，完整課名在詳情頁。
          */}
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold sm:min-h-[2.75rem]">
            {course.name_zh}
          </h3>
          <span className="text-muted-foreground mt-0.5 shrink-0 text-xs tabular-nums">
            {course.id}
          </span>
        </div>

        <p className="text-muted-foreground truncate text-sm">
          {course.teachers.length > 0 ? course.teachers.join('、') : '未定'}
        </p>
        {/* 時段是這張卡最常被掃視的一行,給它比教師名重一階 */}
        <p className="mt-0.5 truncate text-sm font-medium">
          {formatTimeSlots(course, periods)}
        </p>

        {/*
          徽章固定**兩行高**，理由跟課名一樣：高度一致，整列才對得齊。

          為什麼是兩行：三欄時卡片只有 277px，扣掉內距與按鈕位置剩 213px，
          而「校訂共同必修 英語 2 學分 修課 30 人 教室 50 人」要 360px。
          一行放不下，硬擠就是把後面的徽章切掉。

          右邊用 **margin** 而不是 padding 讓出加入課表按鈕的位置：
          `overflow-hidden` 切在 padding 邊緣，用 padding 的話溢出的徽章
          照樣畫得到按鈕上。
        */}
        <div className="mt-2.5 mr-9 flex max-h-[2.875rem] flex-wrap content-end gap-1.5 overflow-hidden sm:mt-auto">
          {course.requirement_type && (
            <Badge tone={isRequired ? 'strong' : 'normal'}>
              {course.requirement_type}
            </Badge>
          )}
          {language && <Badge>{language}</Badge>}
          {course.credits !== null && <Badge tone="quiet">{course.credits} 學分</Badge>}
          {hasEnrolment(course) && (course.enrolled ?? 0) > 0 && (
            // `enrolled` 是修課人數,不是名額上限 —— 文案不能寫「名額」
            <Badge tone="quiet">修課 {course.enrolled} 人</Badge>
          )}
          {/* 分開一個徽章而不是寫成「29 / 90」—— 教室容量**不是選課上限**,
              寫成分數會被讀成名額 */}
          {seats !== undefined && <Badge tone="quiet">教室 {seats} 人</Badge>}
        </div>
      </Link>

      {/*
        放在 `<Link>` **外面** —— 按鈕不能巢狀在連結裡（HTML 不合法，而且點了
        會同時觸發導頁）。絕對定位到卡片右下角，對齊徽章那一列。
      */}
      <div className="absolute right-3 bottom-3">
        <ScheduleToggle course={course} semester={semester} />
      </div>
    </article>
  )
}
