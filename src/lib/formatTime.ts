import type { PeriodDef, TimeSlot } from '@/types/api'

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 星期代碼 → 中文單字。API 的 `day` 是 **0 = 週日**。
 *
 * 課表、匯出圖、時段網格三處都要這張對照,各自複製一份的話,
 * 哪天要改成「週日」還是「日」就會有一處漏掉。
 */
export function dayName(day: number): string {
  return DAY_NAMES[day] ?? String(day)
}

/**
 * 節次的順序**不是字典序** —— `meta.periods` 給的是
 * `1 2 3 4 N 5 6 7 8 9 A B C D`,4 之後是午休 N,9 之後是夜間 A。
 * 一律以那個陣列的順序為準。
 */
function orderOf(periods: readonly PeriodDef[]): Map<string, number> {
  return new Map(periods.map((p, i) => [p.code, i]))
}

/**
 * 把節次切成一段一段連續的區間。
 *
 * 不能無腦取頭尾:`2、4` 當成一段等於謊稱包含第 3 節。
 * meta 沒收錄的代碼另外回傳,由呼叫端決定怎麼處理 —— 不能憑空替它編順序。
 */
function runsOf(
  codes: readonly string[],
  order: Map<string, number>,
): { runs: string[][]; unknown: string[] } {
  const known = codes.filter((c) => order.has(c))
  const unknown = codes.filter((c) => !order.has(c))

  const sorted = [...known].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))

  const runs: string[][] = []
  for (const code of sorted) {
    const last = runs[runs.length - 1]
    const prev = last?.[last.length - 1]
    const isNext =
      prev !== undefined && (order.get(code) ?? 0) === (order.get(prev) ?? 0) + 1
    if (isNext && last) last.push(code)
    else runs.push([code])
  }

  return { runs, unknown }
}

/** 把連續的節次收成 `2-4`,不連續的分開列。 */
function compress(codes: readonly string[], order: Map<string, number>): string {
  const { runs, unknown } = runsOf(codes, order)

  const parts = runs.map((run) => {
    const first = run[0]
    const last = run[run.length - 1]
    if (first === undefined) return ''
    return run.length > 1 && last !== undefined ? `${first}-${last}` : first
  })

  // meta 還沒收錄的節次代碼照樣顯示,不要讓它從畫面上消失
  return [...parts, ...unknown].filter((p) => p !== '').join('、')
}

/**
 * `週五 2-4、週三 5-6`。沒有時段的課回傳「無固定時段」而不是空字串。
 *
 * 只吃 `time_slots` —— 課表的快照不是完整的課程物件,收窄型別才不必到處硬轉。
 */
export function formatTimeSlots(
  course: { time_slots: readonly TimeSlot[] },
  periods: readonly PeriodDef[],
): string {
  if (course.time_slots.length === 0) return '無固定時段'

  const order = orderOf(periods)

  return course.time_slots
    .map((slot) => {
      const day = DAY_NAMES[slot.day] ?? String(slot.day)
      return `週${day} ${compress(slot.periods, order)}`
    })
    .join('、')
}

/**
 * 一個時段的實際起訖時刻,例如 `09:10–12:00`。
 *
 * 節次代碼(`2-4`)對排課的人是熟語,但對第一次看的人不是 —— 詳情頁兩個都給。
 * 不連續的節次分成兩段,理由同 `compress`:併成一段等於謊稱中間那節也要上課。
 *
 * 節次不在 `meta.periods` 裡就不編時間,回傳空字串;呼叫端自己決定要不要顯示。
 */
export function formatSlotClock(slot: TimeSlot, periods: readonly PeriodDef[]): string {
  const order = orderOf(periods)
  const byCode = new Map(periods.map((p) => [p.code, p]))
  const { runs } = runsOf(slot.periods, order)

  return runs
    .map((run) => {
      const start = byCode.get(run[0] ?? '')?.start
      const end = byCode.get(run[run.length - 1] ?? '')?.end
      return start && end ? `${start}–${end}` : ''
    })
    .filter((part) => part !== '')
    .join('、')
}
