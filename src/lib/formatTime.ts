import type { CourseIndexEntry, PeriodDef } from '@/types/api'

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 節次的順序**不是字典序** —— `meta.periods` 給的是
 * `1 2 3 4 N 5 6 7 8 9 A B C D`,4 之後是午休 N,9 之後是夜間 A。
 * 一律以那個陣列的順序為準。
 */
function orderOf(periods: readonly PeriodDef[]): Map<string, number> {
  return new Map(periods.map((p, i) => [p.code, i]))
}

/**
 * 把連續的節次收成 `2-4`,不連續的分開列。
 *
 * 不能無腦取頭尾:`2、4` 寫成 `2-4` 等於謊稱包含第 3 節。
 */
function compress(codes: readonly string[], order: Map<string, number>): string {
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

  const parts = runs.map((run) => {
    const first = run[0]
    const last = run[run.length - 1]
    if (first === undefined) return ''
    return run.length > 1 && last !== undefined ? `${first}-${last}` : first
  })

  // meta 還沒收錄的節次代碼照樣顯示,不要讓它從畫面上消失
  return [...parts, ...unknown].filter((p) => p !== '').join('、')
}

/** `週五 2-4、週三 5-6`。沒有時段的課回傳「無固定時段」而不是空字串。 */
export function formatTimeSlots(
  course: CourseIndexEntry,
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
