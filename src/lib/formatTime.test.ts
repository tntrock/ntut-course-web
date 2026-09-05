import { describe, expect, it } from 'vitest'
import { formatSlotClock, formatTimeSlots } from './formatTime'
import { course, slot } from '@/test/factories'
import type { PeriodDef } from '@/types/api'

/** 實測 meta.json 的節次順序:注意 4 之後是 N,9 之後是 A —— 不是字典序。 */
const periods: PeriodDef[] = [
  '1',
  '2',
  '3',
  '4',
  'N',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
].map((code) => ({ code, start: '', end: '' }))

const fmt = (...slots: ReturnType<typeof slot>[]) =>
  formatTimeSlots(course({ time_slots: slots }), periods)

describe('formatTimeSlots', () => {
  it('連續節次縮寫成範圍', () => {
    expect(fmt(slot(5, '2', '3', '4'))).toBe('週五 2-4')
  })

  it('單一節次不加範圍符號', () => {
    expect(fmt(slot(1, '3'))).toBe('週一 3')
  })

  it('不連續的節次分開列,不能寫成範圍', () => {
    // 寫成「2-4」等於謊稱包含第 3 節
    expect(fmt(slot(5, '2', '4'))).toBe('週五 2、4')
  })

  it('部分連續時,連續的段落才縮寫', () => {
    expect(fmt(slot(5, '2', '3', '6', '7'))).toBe('週五 2-3、6-7')
  })

  it('跨越 4 與 N 的節次算連續 —— 順序以 meta.periods 為準', () => {
    expect(fmt(slot(2, '4', 'N', '5'))).toBe('週二 4-5')
  })

  it('跨越 9 與 A 的夜間節次算連續', () => {
    expect(fmt(slot(3, '9', 'A', 'B'))).toBe('週三 9-B')
  })

  it('節次順序亂給時會先照 meta.periods 排好', () => {
    expect(fmt(slot(5, '4', '2', '3'))).toBe('週五 2-4')
  })

  it('多個星期用頓號分隔', () => {
    expect(fmt(slot(1, '2'), slot(3, '5', '6'))).toBe('週一 2、週三 5-6')
  })

  it('沒有時段的課明確顯示,不是空白', () => {
    expect(formatTimeSlots(course({ time_slots: [] }), periods)).toBe('無固定時段')
  })

  it('週日顯示為週日', () => {
    expect(fmt(slot(0, '1'))).toBe('週日 1')
  })

  it('meta.periods 裡沒有的節次代碼不會被吞掉', () => {
    // 學校若加了新節次而本站的 meta 還沒更新,也不能讓它從畫面上消失
    expect(fmt(slot(5, 'Z'))).toBe('週五 Z')
  })
})

/** 實測 meta.json 的節次時刻。注意 9 結束 18:00、A 才 18:30 開始 —— 中間有斷點。 */
const clockPeriods: PeriodDef[] = [
  ['1', '08:10', '09:00'],
  ['2', '09:10', '10:00'],
  ['3', '10:10', '11:00'],
  ['4', '11:10', '12:00'],
  ['N', '12:10', '13:00'],
  ['5', '13:10', '14:00'],
  ['6', '14:10', '15:00'],
  ['7', '15:10', '16:00'],
  ['8', '16:10', '17:00'],
  ['9', '17:10', '18:00'],
  ['A', '18:30', '19:20'],
  ['B', '19:20', '20:10'],
  ['C', '20:20', '21:10'],
  ['D', '21:10', '22:00'],
].map(([code, start, end]) => ({
  code: code ?? '',
  start: start ?? '',
  end: end ?? '',
}))

const clock = (s: ReturnType<typeof slot>) => formatSlotClock(s, clockPeriods)

describe('formatSlotClock', () => {
  it('連續節次給一段起訖時間', () => {
    expect(clock(slot(5, '2', '3', '4'))).toBe('09:10–12:00')
  })

  it('單一節次也給完整起訖,不只給開始時間', () => {
    expect(clock(slot(1, '3'))).toBe('10:10–11:00')
  })

  it('不連續的節次分成兩段,不能併成一段', () => {
    // 併成「09:10–12:00」會讓使用者以為 10:10-11:00 這段也要上課
    expect(clock(slot(5, '2', '4'))).toBe('09:10–10:00、11:10–12:00')
  })

  it('節次順序按 meta.periods,不是字典序', () => {
    // 4 之後是午休 N 才輪到 5
    expect(clock(slot(2, '4', 'N', '5'))).toBe('11:10–14:00')
  })

  it('meta 沒收錄的節次代碼不會憑空編出時間', () => {
    expect(clock(slot(5, 'Z'))).toBe('')
  })

  it('沒有時段時回傳空字串,由呼叫端決定要不要顯示', () => {
    expect(clock(slot(5))).toBe('')
  })
})
