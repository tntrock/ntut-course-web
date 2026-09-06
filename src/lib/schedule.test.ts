import { describe, expect, it } from 'vitest'
import type { PeriodDef } from '@/types/api'
import type { SavedCourse } from './storage'
import {
  buildGrid,
  conflictingCourseIds,
  diffSnapshot,
  layoutRuns,
  scheduleStats,
  toSnapshot,
  visibleDays,
} from './schedule'
import { course, slot } from '@/test/factories'

/** 實測 meta.json 的節次順序:4 之後是午休 N,9 之後是夜間 A —— 不是字典序。 */
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
].map((code) => ({ code, start: '', end: '' }))

function saved(
  id: string,
  overrides: Partial<SavedCourse['snapshot']> = {},
): SavedCourse {
  return {
    id,
    addedAt: '2026-09-05T10:00:00Z',
    snapshot: {
      name_zh: `課程 ${id}`,
      teachers: ['某老師'],
      teacher_codes: ['10000'],
      time_slots: [],
      classrooms: [],
      credits: 3,
      required: false,
      requirement_type: '專業選修',
      department_ids: ['59'],
      ...overrides,
    },
  }
}

describe('toSnapshot', () => {
  it('只留下比對與離線渲染真正用得到的欄位', () => {
    // 整包課程物件存進 localStorage 會很快吃掉配額,而且大多數欄位
    // (大綱網址、學程、備註)離線畫課表時根本用不到
    const snapshot = toSnapshot(
      course({
        id: '364893',
        name_zh: '數位影像處理',
        teachers: ['白敦文'],
        teacher_codes: ['12095'],
        time_slots: [slot(5, '2', '3', '4')],
        credits: 3,
        required: false,
        requirement_type: '專業選修',
        department_ids: ['59'],
      }),
    )

    expect(snapshot.name_zh).toBe('數位影像處理')
    expect(snapshot.teacher_codes).toEqual(['12095'])
    expect(snapshot.time_slots).toHaveLength(1)
    expect(snapshot).not.toHaveProperty('id')
  })
})

describe('diffSnapshot', () => {
  const base = saved('364893', { time_slots: [slot(5, '2', '3', '4')] }).snapshot

  it('最新資料裡找不到這門課 = 已停開', () => {
    expect(diffSnapshot(base, undefined)).toEqual([{ kind: 'removed' }])
  })

  it('沒有變動時回傳空陣列', () => {
    const current = course({
      teacher_codes: ['10000'],
      time_slots: [slot(5, '2', '3', '4')],
      credits: 3,
    })

    expect(diffSnapshot(base, current)).toEqual([])
  })

  it('時段變了要看得出舊的是什麼、新的是什麼', () => {
    // 只說「有異動」沒用 —— 使用者要知道新時段會不會撞到別堂課
    const current = course({
      teacher_codes: ['10000'],
      time_slots: [slot(3, '5', '6')],
      credits: 3,
    })

    expect(diffSnapshot(base, current)).toEqual([
      { kind: 'time', from: base.time_slots, to: current.time_slots },
    ])
  })

  it('節次順序不同但內容相同時不算異動', () => {
    // 來源資料的排序不保證穩定,拿順序當差異會製造假警報
    const current = course({
      teacher_codes: ['10000'],
      time_slots: [slot(5, '4', '2', '3')],
      credits: 3,
    })

    expect(diffSnapshot(base, current)).toEqual([])
  })

  it('教師以代碼比對,不是姓名', () => {
    // 同名老師有兩位。改名字不算換人,換代碼才是
    const renamed = course({
      teachers: ['白老師'],
      teacher_codes: ['10000'],
      time_slots: [slot(5, '2', '3', '4')],
      credits: 3,
    })
    expect(diffSnapshot(base, renamed)).toEqual([])

    const replaced = course({
      teacher_codes: ['99999'],
      time_slots: [slot(5, '2', '3', '4')],
      credits: 3,
    })
    expect(diffSnapshot(base, replaced)).toEqual([
      { kind: 'teachers', from: ['10000'], to: ['99999'] },
    ])
  })

  it('學分變了要標出來 —— 那會影響畢業學分試算', () => {
    const current = course({
      teacher_codes: ['10000'],
      time_slots: [slot(5, '2', '3', '4')],
      credits: 2,
    })

    expect(diffSnapshot(base, current)).toEqual([{ kind: 'credits', from: 3, to: 2 }])
  })

  it('多個欄位同時變動時全部列出', () => {
    const current = course({
      teacher_codes: ['99999'],
      time_slots: [slot(1, '1')],
      credits: 1,
    })

    expect(
      diffSnapshot(base, current)
        .map((c) => c.kind)
        .sort(),
    ).toEqual(['credits', 'teachers', 'time'])
  })
})

describe('buildGrid', () => {
  it('把課放進對應的格子', () => {
    const grid = buildGrid([saved('a', { time_slots: [slot(5, '2', '3')] })])

    expect(grid.cells.get('5-2')?.map((c) => c.id)).toEqual(['a'])
    expect(grid.cells.get('5-3')?.map((c) => c.id)).toEqual(['a'])
    expect(grid.cells.get('5-4')).toBeUndefined()
  })

  it('同一格有兩門課就是衝堂', () => {
    const grid = buildGrid([
      saved('a', { time_slots: [slot(1, '2', '3')] }),
      saved('b', { time_slots: [slot(1, '3', '4')] }),
    ])

    expect([...grid.conflicts]).toEqual(['1-3'])
    expect(grid.cells.get('1-3')).toHaveLength(2)
  })

  it('沒有時段的課單獨列出,不能讓它從畫面上消失', () => {
    // 體育、班週會這類實測有 249 門。掉在格子外等於使用者以為課不見了
    const grid = buildGrid([
      saved('a', { time_slots: [slot(1, '2')] }),
      saved('b', { time_slots: [] }),
    ])

    expect(grid.unscheduled.map((c) => c.id)).toEqual(['b'])
    expect(grid.cells.size).toBe(1)
  })

  it('同一門課在同一格出現兩次時只算一次,不會自己跟自己衝堂', () => {
    const grid = buildGrid([saved('a', { time_slots: [slot(1, '2'), slot(1, '2')] })])

    expect(grid.cells.get('1-2')).toHaveLength(1)
    expect(grid.conflicts.size).toBe(0)
  })
})

describe('scheduleStats', () => {
  it('總學分把每一門加起來', () => {
    const stats = scheduleStats(
      [saved('a', { credits: 3 }), saved('b', { credits: 2 })],
      periods,
    )

    expect(stats.totalCredits).toBe(5)
    expect(stats.courseCount).toBe(2)
  })

  it('必修與選修分開算,`required` 為 null 的第三態另計', () => {
    // required 是三態,把 null 當成選修會讓學分試算悄悄算錯
    const stats = scheduleStats(
      [
        saved('a', { credits: 3, required: true }),
        saved('b', { credits: 2, required: false }),
        saved('c', { credits: 1, required: null }),
      ],
      periods,
    )

    expect(stats.requiredCredits).toBe(3)
    expect(stats.electiveCredits).toBe(2)
    expect(stats.unclassifiedCredits).toBe(1)
    expect(stats.totalCredits).toBe(6)
  })

  it('學分為 null 的課不計入總分,但要數出來', () => {
    // 當成 0 分會讓總學分看起來是對的,其實少算 —— 那比顯示「1 門未提供」危險
    const stats = scheduleStats(
      [saved('a', { credits: 3 }), saved('b', { credits: null })],
      periods,
    )

    expect(stats.totalCredits).toBe(3)
    expect(stats.unknownCreditCount).toBe(1)
  })

  it('每日課量算的是節數不是門數', () => {
    // 「週一 3 門」和「週一 9 節」對排課的人是不同的資訊
    const stats = scheduleStats(
      [
        saved('a', { time_slots: [slot(1, '2', '3', '4')] }),
        saved('b', { time_slots: [slot(1, '5')] }),
      ],
      periods,
    )

    expect(stats.perDay.get(1)).toBe(4)
    expect(stats.perDay.get(2) ?? 0).toBe(0)
  })

  it('最早與最晚一堂照 meta.periods 的順序,不是字典序', () => {
    // 「A」(夜間)排在「5」後面。用字典序會說最晚一堂是 5
    const stats = scheduleStats(
      [
        saved('a', { time_slots: [slot(1, '5')] }),
        saved('b', { time_slots: [slot(3, 'A', '2')] }),
      ],
      periods,
    )

    expect(stats.earliest).toBe('2')
    expect(stats.latest).toBe('A')
  })

  it('完全沒有課時不會回傳 NaN 或亂數', () => {
    const stats = scheduleStats([], periods)

    expect(stats.totalCredits).toBe(0)
    expect(stats.earliest).toBeNull()
    expect(stats.latest).toBeNull()
  })
})

describe('layoutRuns', () => {
  it('連續節次合併成一段,課名才不會每一格重印一次', () => {
    const runs = layoutRuns(
      [saved('a', { time_slots: [slot(5, '2', '3', '4')] })],
      periods,
    )

    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ day: 5, start: 1, span: 3 })
  })

  it('不連續的節次分成兩段,不能連成一塊', () => {
    // 連成一塊等於在課表上宣稱第 3 節也要上課
    const runs = layoutRuns([saved('a', { time_slots: [slot(5, '2', '4')] })], periods)

    expect(runs.map((r) => [r.start, r.span])).toEqual([
      [1, 1],
      [3, 1],
    ])
  })

  it('連續與否照 meta.periods 的順序 —— 4 的下一節是午休 N', () => {
    const runs = layoutRuns(
      [saved('a', { time_slots: [slot(1, '4', 'N', '5')] })],
      periods,
    )

    expect(runs).toHaveLength(1)
    expect(runs[0]?.span).toBe(3)
  })

  it('meta 沒收錄的節次代碼跳過,不會被放到錯的位置', () => {
    // 憑空塞進格子裡比不顯示更糟 —— 使用者會照著錯的時間去上課
    const runs = layoutRuns([saved('a', { time_slots: [slot(1, 'Z')] })], periods)

    expect(runs).toEqual([])
  })

  it('不同天各自成段', () => {
    const runs = layoutRuns(
      [saved('a', { time_slots: [slot(1, '2'), slot(3, '2')] })],
      periods,
    )

    expect(runs.map((r) => r.day)).toEqual([1, 3])
  })
})

describe('visibleDays', () => {
  it('預設只顯示週一到週五', () => {
    expect(visibleDays([saved('a', { time_slots: [slot(1, '2')] })], false)).toEqual([
      1, 2, 3, 4, 5,
    ])
  })

  it('設定打開時顯示週末', () => {
    expect(visibleDays([], true)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('週末有課時**一定顯示**,即使設定關著', () => {
    // 設定關著就把週六的課藏起來,等於課表在說謊
    expect(visibleDays([saved('a', { time_slots: [slot(6, '2')] })], false)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('週日有課時也一樣', () => {
    expect(visibleDays([saved('a', { time_slots: [slot(0, '2')] })], false)).toEqual([
      1, 2, 3, 4, 5, 0,
    ])
  })
})

describe('conflictingCourseIds', () => {
  it('列出所有涉及衝堂的課號,不只是格子', () => {
    // 只標那一格的話,使用者知道有衝堂卻不知道是哪兩門在撞
    const grid = buildGrid([
      saved('a', { time_slots: [slot(1, '2')] }),
      saved('b', { time_slots: [slot(1, '2')] }),
      saved('c', { time_slots: [slot(3, '2')] }),
    ])

    expect([...conflictingCourseIds(grid)].sort()).toEqual(['a', 'b'])
  })
})

describe('layoutRuns 的並排欄位', () => {
  it('沒有重疊時每門課佔滿整欄', () => {
    const runs = layoutRuns([saved('a', { time_slots: [slot(1, '2')] })], periods)

    expect(runs[0]).toMatchObject({ lane: 0, lanes: 1 })
  })

  it('完全重疊的兩門課並排,不是疊在一起', () => {
    // 疊在一起的話課名會互相蓋掉,使用者根本看不出衝堂的是哪兩門
    const runs = layoutRuns(
      [
        saved('a', { time_slots: [slot(1, '2', '3')] }),
        saved('b', { time_slots: [slot(1, '2', '3')] }),
      ],
      periods,
    )

    expect(runs.map((r) => [r.lane, r.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('部分重疊也要並排', () => {
    const runs = layoutRuns(
      [
        saved('a', { time_slots: [slot(1, '2', '3')] }),
        saved('b', { time_slots: [slot(1, '3', '4')] }),
      ],
      periods,
    )

    expect(runs.every((r) => r.lanes === 2)).toBe(true)
  })

  it('同一天但分開的兩組各自算欄數,不會被彼此拖窄', () => {
    // 早上衝堂不該讓下午那門課也變成半格寬
    const runs = layoutRuns(
      [
        saved('a', { time_slots: [slot(1, '1')] }),
        saved('b', { time_slots: [slot(1, '1')] }),
        saved('c', { time_slots: [slot(1, '8')] }),
      ],
      periods,
    )

    const afternoon = runs.find((r) => r.course.id === 'c')
    expect(afternoon?.lanes).toBe(1)
  })

  it('不同天不會互相影響', () => {
    const runs = layoutRuns(
      [
        saved('a', { time_slots: [slot(1, '2')] }),
        saved('b', { time_slots: [slot(2, '2')] }),
      ],
      periods,
    )

    expect(runs.every((r) => r.lanes === 1)).toBe(true)
  })
})
