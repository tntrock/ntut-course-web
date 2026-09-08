import { Link } from '@tanstack/react-router'

import type { Range } from '@/hooks/useWithdrawal'
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
  range,
}: {
  row: Row
  /** 只有依退選率排序時才有名次 —— 照姓名排的「第 3 名」沒有意義。 */
  rank: number | null
  /** 教師頁要用的學期。課程列用 `row.semester`。 */
  semester: SemesterPath
  kind: 'teacher' | 'course'
  showSemester: boolean
  /** 目前看的期間。帶到教師頁,點進去才看得到同一個窗口的課。 */
  range: Range
}) {
  const detail = row.detail.slice(0, MAX_DETAIL).join('、')
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
        <span className="text-muted-foreground block truncate text-xs">
          {detail === '' ? '未定' : detail}
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
      /*
       * **學期用畫面上選的、期間一起帶過去。** 教師頁收到 range 之後會把整個
       * 窗口的課都撈出來,少掉的學期當作那學期沒開課 —— 所以老師在起始學期
       * 沒開課也不會變成「查無此教師」(實測前 100 名有 46 位是這種)。
       */
      params={{ semester, teacherId: row.key }}
      search={{ range }}
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
