import type { EnrollmentPoint } from '@/lib/enrollment'

/**
 * 這門課近幾天的修課 / 撤選人數。
 *
 * **純顯示,不自己抓資料。** 沒有資料時要連「近日人數」那個標題一起收掉,
 * 而標題在呼叫端 —— 元件自己回傳 `null` 是沒有用的,外層的 `<Row>` 只看得到
 * 「有一個 React 元素」,還是會畫出一個空欄位。所以由呼叫端拿 `series` 判斷。
 */
export function EnrollmentHistory({ series }: { series: readonly EnrollmentPoint[] }) {
  if (series.length === 0) return null

  return (
    <div>
      <ol className="space-y-1">
        {series.map((point) => (
          <li key={point.date} className="flex items-baseline gap-3 text-sm">
            <span className="text-muted-foreground w-14 shrink-0 tabular-nums">
              {/* 年份對這一塊沒有意義,只會佔掉手機的寬度 */}
              {point.date.slice(5)}
            </span>
            <span className="tabular-nums">修課 {point.enrolled}</span>
            {point.withdrawn > 0 && (
              <span className="text-muted-foreground tabular-nums">
                撤選 {point.withdrawn}
              </span>
            )}
            {/*
              變化量只在真的有變的時候顯示。每天都印一個「0」會讓整欄都是雜訊,
              而「跟前一天一樣」本來就是預設狀態。
            */}
            {point.change !== null && point.change !== 0 && (
              <span
                className={`tabular-nums ${
                  point.change > 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {point.change > 0 ? '+' : ''}
                {point.change}
              </span>
            )}
          </li>
        ))}
      </ol>

      {/*
        **要講出來只有幾天。** 快照是這個站開始跑之後才有的,寫「近 7 天」
        但只列出 4 天,看起來像少了資料。
      */}
      <p className="text-muted-foreground mt-2 text-xs">
        目前累積 {series.length} 天。每天抓一次，學期中才看得出加退選的變化。
      </p>
    </div>
  )
}
