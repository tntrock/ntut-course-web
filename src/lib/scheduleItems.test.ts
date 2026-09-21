import { describe, expect, it } from 'vitest'
import {
  buildGrid,
  conflictingKeys,
  courseItem,
  eventItem,
  layoutRuns,
  visibleDays,
} from './schedule'
import { newEvent } from './events'
import type { SavedCourse } from './storage'
import type { PeriodDef, TimeSlot } from '@/types/api'

/**
 * 個人事務要跟課程走**同一條排版路徑**。
 *
 * 分成兩套的話,衝堂偵測與分欄各會長出一份,而這個功能存在的理由正是
 * 「事務跟課要能撞在一起」—— 兩套實作遲早在這件事上不一致。
 */

const PERIODS: PeriodDef[] = [
  { code: '3', start: '10:10', end: '11:00' },
  { code: '4', start: '11:10', end: '12:00' },
  { code: 'N', start: '12:10', end: '13:00' },
]

function slot(day: number, periods: string[]): TimeSlot {
  return { day: day as TimeSlot['day'], day_name: '', periods }
}

function savedCourse(id: string, slots: TimeSlot[]): SavedCourse {
  return {
    id,
    addedAt: '',
    snapshot: {
      name_zh: `課程${id}`,
      teachers: [],
      teacher_codes: [],
      time_slots: slots,
      classrooms: [],
      credits: 3,
      required: null,
      requirement_type: null,
      department_ids: [],
    },
  }
}

describe('事務與課程共用格線', () => {
  it('事務跟課撞在同一格時,兩邊都被標成衝堂', () => {
    const course = savedCourse('364540', [slot(3, ['3', '4'])])
    const event = newEvent('打工', [slot(3, ['4'])], null)

    const grid = buildGrid([courseItem(course), eventItem(event)])
    const keys = conflictingKeys(grid)

    expect(grid.conflicts.size).toBe(1)
    expect(keys.has(`course:${course.id}`)).toBe(true)
    expect(keys.has(`event:${event.id}`)).toBe(true)
  })

  it('沒有衝到的時候不標', () => {
    const course = savedCourse('364540', [slot(3, ['3'])])
    const event = newEvent('打工', [slot(3, ['N'])], null)

    const grid = buildGrid([courseItem(course), eventItem(event)])

    expect(grid.conflicts.size).toBe(0)
    expect(conflictingKeys(grid).size).toBe(0)
  })

  /**
   * 課號是六位數字、事務一律帶 `evt_` 前綴,現實中撞不到 —— 但格子裡的
   * 識別碼還是帶上 kind,讓它在型別上就不可能撞。
   */
  it('課號與事務 id 剛好相同時仍然分得開', () => {
    const course = savedCourse('X', [slot(3, ['3'])])
    const event: ReturnType<typeof newEvent> = {
      ...newEvent('打工', [slot(3, ['3'])], null),
      id: 'X',
    }

    const keys = conflictingKeys(buildGrid([courseItem(course), eventItem(event)]))

    expect([...keys].sort()).toEqual(['course:X', 'event:X'])
  })

  it('事務也會分欄,不會跟課疊在一起', () => {
    const course = savedCourse('364540', [slot(3, ['3', '4'])])
    const event = newEvent('打工', [slot(3, ['3', '4'])], null)

    const runs = layoutRuns([courseItem(course), eventItem(event)], PERIODS)

    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.lanes === 2)).toBe(true)
    expect(new Set(runs.map((r) => r.lane))).toEqual(new Set([0, 1]))
  })

  it('沒有時段的事務進 unscheduled,不會憑空塞進某一格', () => {
    const event = newEvent('待安排', [], null)

    const grid = buildGrid([eventItem(event)])

    expect(grid.cells.size).toBe(0)
    expect(grid.unscheduled).toHaveLength(1)
  })

  /** 週末預設收起來,但有東西就一定顯示 —— 藏起來等於課表在說謊。 */
  it('週六只有事務沒有課時,週六照樣顯示', () => {
    const event = newEvent('社團', [slot(6, ['3'])], null)

    expect(visibleDays([eventItem(event)], false)).toContain(6)
  })
})
