import { describe, expect, it } from 'vitest'
import { buildingOf, freeClassrooms, groupByBuilding, occupiedCourseIds } from './rooms'
import type { Classroom, ScheduleResponse } from '@/types/api'

/** 星期 × 節次 → 課號。這裡只放測試要用的格子。 */
function schedule(buckets: Record<string, string[]>): ScheduleResponse {
  const days = new Map<number, { code: string; course_ids: string[] }[]>()
  for (const [key, ids] of Object.entries(buckets)) {
    const [day, code] = key.split('-') as [string, string]
    const list = days.get(Number(day)) ?? []
    list.push({ code, course_ids: ids })
    days.set(Number(day), list)
  }
  return {
    schema_version: 3,
    year: 115,
    sem: 1,
    periods: [],
    days: [...days].map(([day, periods]) => ({
      day: day as never,
      day_name: '',
      periods: periods.map((p) => ({
        code: p.code,
        course_count: p.course_ids.length,
        course_ids: p.course_ids,
      })),
    })),
  }
}

function room(id: string, name: string, courseIds: string[]): Classroom {
  return { id, name, course_count: courseIds.length, course_ids: courseIds, url: '' }
}

describe('occupiedCourseIds', () => {
  it('把選到的每一格的課號收在一起', () => {
    const s = schedule({ '3-5': ['a', 'b'], '3-6': ['b', 'c'] })
    expect(occupiedCourseIds(s, ['3-5', '3-6'])).toEqual(new Set(['a', 'b', 'c']))
  })

  it('沒選格子就是空集合', () => {
    expect(occupiedCourseIds(schedule({ '3-5': ['a'] }), [])).toEqual(new Set())
  })

  it('認不得的格子直接跳過,不要爆掉', () => {
    // 網址是使用者可以亂打的
    const s = schedule({ '3-5': ['a'] })
    expect(occupiedCourseIds(s, ['3-5', '9-Z'])).toEqual(new Set(['a']))
  })
})

describe('freeClassrooms', () => {
  const rooms = [
    room('1', '三教308', ['a']),
    room('2', '三教406', ['c']),
    room('3', '六教727', []),
  ]

  it('選到的每一格都要空才算空教室', () => {
    // 使用者框「週三 5、6」是想借連續兩節,只空一節沒有用
    const s = schedule({ '3-5': ['a'], '3-6': ['c'] })
    expect(freeClassrooms(s, rooms, ['3-5', '3-6']).map((r) => r.name)).toEqual([
      '六教727',
    ])
  })

  it('只框一格時只看那一格', () => {
    const s = schedule({ '3-5': ['a'], '3-6': ['c'] })
    expect(freeClassrooms(s, rooms, ['3-6']).map((r) => r.name)).toEqual([
      '三教308',
      '六教727',
    ])
  })

  it('沒框任何格子時不回傳結果', () => {
    // 全部 234 間都「空」是沒有意義的答案,畫面該提示先選時段
    expect(freeClassrooms(schedule({}), rooms, [])).toEqual([])
  })

  it('完全沒課的教室一定算空', () => {
    const s = schedule({ '1-1': ['a', 'c'] })
    expect(freeClassrooms(s, rooms, ['1-1']).map((r) => r.name)).toEqual(['六教727'])
  })
})

describe('buildingOf', () => {
  it('取名稱開頭的中文部分當建築物', () => {
    expect(buildingOf('三教308(e)')).toBe('三教')
    expect(buildingOf('億光0612')).toBe('億光')
    expect(buildingOf('科研大樓1222')).toBe('科研大樓')
  })

  it('停在英文字母,不是只停在數字', () => {
    // 實測有 設計B01 / 綜科B.. / 分子BR.. 這種命名。
    // 只擋數字會分出「設計B」「綜科B」這些不存在的建築物
    expect(buildingOf('設計B01')).toBe('設計')
    expect(buildingOf('分子BR01')).toBe('分子')
  })

  it('沒有英數字的名稱整個當建築物', () => {
    expect(buildingOf('共同演講廳')).toBe('共同演講廳')
  })
})

describe('groupByBuilding', () => {
  it('依建築物分組,組內照原順序', () => {
    // 234 間平鋪沒辦法看,一定要分組
    const groups = groupByBuilding([
      room('1', '三教308', []),
      room('2', '六教727', []),
      room('3', '三教406', []),
    ])
    expect(groups).toEqual([
      { building: '三教', rooms: [expect.anything(), expect.anything()] },
      { building: '六教', rooms: [expect.anything()] },
    ])
    expect(groups[0]?.rooms.map((r) => r.name)).toEqual(['三教308', '三教406'])
  })
})
