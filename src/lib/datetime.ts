/**
 * crawler 發布的時間一律是 UTC(字串尾巴帶 `Z`),但使用者是北科的學生 ——
 * 一律換算成台灣時間顯示,而不是瀏覽器所在時區。
 */
const TAIPEI = 'Asia/Taipei'

const formatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TAIPEI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** `"2026-09-05T03:34:59Z"` → `"2026-09-05 11:34"`。無法解析時原樣回傳。 */
export function formatTaipei(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const parts = new Map(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  const y = parts.get('year')
  const m = parts.get('month')
  const d = parts.get('day')
  const hh = parts.get('hour')
  const mm = parts.get('minute')
  if (!y || !m || !d || !hh || !mm) return iso

  return `${y}-${m}-${d} ${hh}:${mm}`
}

/**
 * 距今幾小時(無條件捨去)。用來判斷資料新鮮度 ——
 * `changes.json` 的 `checked_at` 超過 12 小時要顯示警告。
 *
 * 未來的時間回傳 0:時鐘不準時顯示「-3 小時前」只會讓人困惑。
 */
export function hoursSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 0

  const diffMs = now.getTime() - then.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60))
}
