import { describe, expect, it } from 'vitest'
import { courseSeries, recentSnapshots } from './enrollment'
import type { DailyEnrollment, EnrollmentSnapshot } from '@/types/api'

const snap = (semester: string, date: string): EnrollmentSnapshot => ({
  semester,
  year: 115,
  sem: 1,
  date,
  at: `${date}T08:00:00Z`,
  course_count: 10,
  enrolled_total: 100,
  withdrawn_total: 0,
  path: `${semester}/enrollment/${date}.json`,
})

describe('recentSnapshots', () => {
  const index = [
    snap('115-1', '2026-09-08'),
    snap('114-2', '2026-09-08'),
    snap('115-1', '2026-09-06'),
    snap('115-1', '2026-09-07'),
    snap('114-2', '2026-09-07'),
  ]

  it('只取這個學期的 —— 快照是逐學期的,混在一起就是別班的人數', () => {
    expect(recentSnapshots(index, '115-1', 7).map((s) => s.date)).toEqual([
      '2026-09-08',
      '2026-09-07',
      '2026-09-06',
    ])
  })

  it('由新到舊,不管索引本來的順序', () => {
    const [first] = recentSnapshots(index, '115-1', 7)
    expect(first?.date).toBe('2026-09-08')
  })

  it('最多取指定天數', () => {
    expect(recentSnapshots(index, '115-1', 2).map((s) => s.date)).toEqual([
      '2026-09-08',
      '2026-09-07',
    ])
  })

  it('這個學期沒有快照時回傳空陣列', () => {
    expect(recentSnapshots(index, '113-1', 7)).toEqual([])
  })
})

describe('courseSeries', () => {
  const daily = (date: string, enrolled: number, withdrawn = 0): DailyEnrollment => ({
    schema_version: 1,
    year: 115,
    sem: 1,
    date,
    at: `${date}T08:00:00Z`,
    course_count: 2,
    enrolled_total: enrolled,
    withdrawn_total: withdrawn,
    courses: [
      { id: '361496', enrolled, withdrawn },
      { id: '999999', enrolled: 1, withdrawn: 0 },
    ],
  })

  it('挑出這門課,由新到舊', () => {
    const got = courseSeries(
      [daily('2026-09-08', 40), daily('2026-09-07', 38)],
      '361496',
    )
    expect(got.map((p) => [p.date, p.enrolled])).toEqual([
      ['2026-09-08', 40],
      ['2026-09-07', 38],
    ])
  })

  it('算出跟前一天的差', () => {
    const got = courseSeries(
      [daily('2026-09-08', 40), daily('2026-09-07', 38), daily('2026-09-06', 38)],
      '361496',
    )
    expect(got.map((p) => p.change)).toEqual([2, 0, null])
  })

  it('那天還沒有這門課就跳過,不要當成 0 人', () => {
    // 加開的課在更早的快照裡根本不存在。畫成 0 會看起來像全部退光
    const missing: DailyEnrollment = { ...daily('2026-09-06', 0), courses: [] }
    const got = courseSeries([daily('2026-09-08', 40), missing], '361496')
    expect(got.map((p) => p.date)).toEqual(['2026-09-08'])
  })

  it('完全沒有這門課的紀錄時回傳空陣列', () => {
    expect(courseSeries([daily('2026-09-08', 40)], '不存在')).toEqual([])
  })
})
