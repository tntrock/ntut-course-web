import { describe, expect, it } from 'vitest'
import { formatTaipei, hoursSince } from './datetime'

describe('formatTaipei', () => {
  it('把 UTC 時間換算成台灣時間顯示', () => {
    // crawler 發布的時間一律是 UTC(尾巴的 Z),使用者看的是台灣時間
    expect(formatTaipei('2026-09-05T03:34:59Z')).toBe('2026-09-05 11:34')
  })

  it('跨日的換算不會少算一天', () => {
    expect(formatTaipei('2026-09-04T17:46:42Z')).toBe('2026-09-05 01:46')
  })

  it('拿到不是時間的字串時回傳原字串,不顯示 Invalid Date', () => {
    expect(formatTaipei('不是時間')).toBe('不是時間')
  })
})

describe('hoursSince', () => {
  it('算出距今幾小時', () => {
    const now = new Date('2026-09-05T12:00:00Z')

    expect(hoursSince('2026-09-05T00:00:00Z', now)).toBe(12)
  })

  it('未來的時間算成 0,不會出現負數小時', () => {
    const now = new Date('2026-09-05T12:00:00Z')

    expect(hoursSince('2026-09-05T13:00:00Z', now)).toBe(0)
  })
})
