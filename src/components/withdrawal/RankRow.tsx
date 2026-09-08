import { Link } from '@tanstack/react-router'

import type { Row } from '@/lib/withdrawal'
import type { SemesterPath } from '@/types/api'

/** 一列最多列幾門課。連開六個學期的老師不折斷會把整列撐爆。 */
const MAX_DETAIL = 3

export function RankRow({
  row,
  rank,
  semester,
  kind,
  showSemester,
}: {
  row: Row
  /** 只有依退選率排序時才有名次 —— 照姓名排的「第 3 名」沒有意義。 */
  rank: number | null
  /** 教師頁要用的學期。課程列用 `row.semester`。 */
  semester: SemesterPath
  kind: 'teacher' | 'course'
  showSemester: boolean
}) {
  const shown = row.detail.slice(0, MAX_DETAIL)
  const more = row.detail.length - MAX_DETAIL

  const body = (
    <>
      {rank !== null && (
        <span className="text-muted-foreground w-7 shrink-0 text-right text-xs tabular-nums">
          {rank}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm">{row.name}</span>
          {showSemester && row.semester !== undefined && (
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {row.semester}
            </span>
          )}
        </span>
        {/*
          課名後面接它開過的學期。**這一頁彙總好幾個學期**,不標年度就看不出
          這門課是哪一年的 —— 而其他頁面都只看單一學期,不需要這個標示。

          學期用 `/` 分隔、課程之間用「、」,兩層才分得開:
          「物件導向程式設計 114-2/113-2、視窗程式設計 114-1」
        */}
        <span className="text-muted-foreground block truncate text-xs">
          {shown.length === 0
            ? '未定'
            : shown.map((item, i) => (
                <span key={item.text}>
                  {i > 0 && '、'}
                  {item.text}
                  {item.semesters && item.semesters.length > 0 && (
                    <span className="ml-1 tabular-nums opacity-70">
                      {item.semesters.join('/')}
                    </span>
                  )}
                </span>
              ))}
          {more > 0 && ` 等 ${row.detail.length} 門`}
        </span>
      </span>
      {/* 比率與原始人次一定要並排 —— 只給比率就是在鼓勵誤讀 */}
      <span className="shrink-0 text-right">
        <span className="block text-sm font-medium tabular-nums">
          {(row.rate * 100).toFixed(1)}%
        </span>
        <span className="text-muted-foreground block text-xs tabular-nums">
          撤 {row.withdrawn} / {row.base} 人
        </span>
      </span>
    </>
  )

  const className =
    'bg-card shadow-card hover:bg-accent flex items-center gap-3 rounded-xl px-3 py-2.5'

  return kind === 'teacher' ? (
    <Link
      to="/teacher/$semester/$teacherId"
      // **不能用畫面上選的學期。** 這一頁彙總好幾個學期,實測前 100 名有 46 位
      // 在最新學期根本沒開課,連過去只會看到「查無此教師」
      params={{ semester: row.linkSemester ?? semester, teacherId: row.key }}
      className={className}
    >
      {body}
    </Link>
  ) : (
    <Link
      to="/course/$semester/$courseId"
      params={{ semester: row.semester ?? semester, courseId: row.key }}
      className={className}
    >
      {body}
    </Link>
  )
}
