import { describe, expect, it } from 'vitest'
import { formatTimeSlots } from './formatTime'
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
