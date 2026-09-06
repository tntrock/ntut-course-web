import { describe, expect, it } from 'vitest'
import type { ChangeEvent } from '@/types/api'
import {
  bulkBreakdown,
  fieldLabel,
  formatFieldValue,
  groupByDate,
  isStale,
  semestersNeedingNames,
} from './changes'

function removed(at: string, semester = '115-1'): ChangeEvent {
  return {
    at,
    semester,
    type: 'course_removed',
    id: '362717',
    name: '電磁學(一)',
    teachers: ['馬尚智'],
    department_ids: ['B2'],
    class_ids: ['3222'],
  }
}

function baseline(at: string, semester: string): ChangeEvent {
  return { at, semester, type: 'baseline', course_count: 2717 }
}

describe('groupByDate', () => {
  it('依台北日期分組,新的在前', () => {
    const groups = groupByDate([
      removed('2026-09-02T02:00:00Z'),
      removed('2026-09-04T02:00:00Z'),
    ])

    expect(groups.map((g) => g.date)).toEqual(['2026-09-04', '2026-09-02'])
  })

  it('UTC 傍晚的事件歸到台北的隔天', () => {
    // 直接切 ISO 字串會把它分到 09-04,但台北時間已經是 09-05 凌晨
    const groups = groupByDate([removed('2026-09-04T18:00:00Z')])

    expect(groups[0]?.date).toBe('2026-09-05')
  })

  it('同一天的事件也照時間由新到舊', () => {
    const groups = groupByDate([
      removed('2026-09-04T02:00:00Z'),
      removed('2026-09-04T10:00:00Z'),
    ])

    expect(groups[0]?.events.map((e) => e.at)).toEqual([
      '2026-09-04T10:00:00Z',
      '2026-09-04T02:00:00Z',
    ])
  })

  it('沒有事件時回傳空陣列', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('isStale', () => {
  const now = new Date('2026-09-06T12:00:00Z')

  it('12 小時內算新鮮', () => {
    expect(isStale('2026-09-06T01:00:00Z', now)).toBe(false)
  })

  it('超過 12 小時要警告 —— 那代表爬蟲沒在跑,不是學校沒異動', () => {
    expect(isStale('2026-09-05T20:00:00Z', now)).toBe(true)
  })

  it('未來的時間不算過期,時鐘不準不該變成警告', () => {
    expect(isStale('2026-09-07T00:00:00Z', now)).toBe(false)
  })
})

describe('semestersNeedingNames', () => {
  it('只回傳真的有代碼要翻譯的學期', () => {
    // baseline 只有課程數,沒有系所或班級代碼。為它多打兩個請求是白費
    const semesters = semestersNeedingNames([
      baseline('2026-09-01T00:00:00Z', '112-1'),
      baseline('2026-09-01T00:00:00Z', '113-2'),
      removed('2026-09-04T02:00:00Z', '115-1'),
    ])

    expect(semesters).toEqual(['115-1'])
  })

  it('同一學期只列一次', () => {
    const semesters = semestersNeedingNames([
      removed('2026-09-04T02:00:00Z', '115-1'),
      removed('2026-09-04T03:00:00Z', '115-1'),
    ])

    expect(semesters).toEqual(['115-1'])
  })

  it('bulk_change 也需要 —— by_department 與 by_class 都是代碼', () => {
    const bulk: ChangeEvent = {
      at: '2026-09-04T10:24:06Z',
      semester: '114-2',
      type: 'bulk_change',
      event_count: 267,
      counts: { course_added: 265 },
      by_department: { '01': 185 },
      by_class: {},
      samples: [],
      note: null,
    }

    expect(semestersNeedingNames([bulk])).toEqual(['114-2'])
  })
})

describe('fieldLabel', () => {
  it('已知欄位翻成中文', () => {
    expect(fieldLabel('department_ids')).toBe('開課系所')
    expect(fieldLabel('time_slots')).toBe('時段')
  })

  it('不認得的欄位原樣顯示,不要藏起來', () => {
    // 藏起來的話,crawler 新增偵測欄位時我們永遠不會發現
    expect(fieldLabel('brand_new_field')).toBe('brand_new_field')
  })
})

describe('formatFieldValue', () => {
  const names = {
    department: (id: string) => ({ B2: '電子系', '31': '電機系' })[id] ?? id,
    classGroup: (id: string) => ({ '3222': '半導體四' })[id] ?? id,
  }

  it('系所代碼翻成中文名', () => {
    // 「from 31 to B2,31」對使用者毫無意義
    expect(formatFieldValue('department_ids', ['B2', '31'], names)).toBe(
      '電子系、電機系',
    )
  })

  it('班級代碼也翻', () => {
    expect(formatFieldValue('class_ids', ['3222'], names)).toBe('半導體四')
  })

  it('翻不到的代碼原樣顯示,不要變成空白', () => {
    expect(formatFieldValue('department_ids', ['ZZ'], names)).toBe('ZZ')
  })

  it('一般陣列用頓號串起來', () => {
    expect(formatFieldValue('teachers', ['甲', '乙'], names)).toBe('甲、乙')
  })

  it('空陣列與 null 顯示成「無」,不是空字串', () => {
    // 空字串會讓 「舊 → 新」變成「 → 電子系」,看起來像壞掉
    expect(formatFieldValue('teachers', [], names)).toBe('無')
    expect(formatFieldValue('credits', null, names)).toBe('無')
  })

  it('數字與字串直接顯示', () => {
    expect(formatFieldValue('credits', 3, names)).toBe('3')
    expect(formatFieldValue('name_zh', '電磁學', names)).toBe('電磁學')
  })

  it('認不得的結構退回 JSON,不要顯示 [object Object]', () => {
    expect(formatFieldValue('time_slots', [{ day: 5 }], names)).toContain('day')
  })
})

describe('bulkBreakdown', () => {
  const translate = (id: string) =>
    ({ '01': '教務處', '14': '通識中心', '36': '化工系' })[id] ?? id

  it('照數量由多到少排', () => {
    const rows = bulkBreakdown({ '14': 80, '01': 185, '36': 1 }, translate)

    expect(rows.map((r) => r.name)).toEqual(['教務處', '通識中心', '化工系'])
    expect(rows[0]?.count).toBe(185)
  })

  it('數量相同時照代碼排,順序才穩定', () => {
    const rows = bulkBreakdown({ b: 5, a: 5 }, translate)

    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('只取前 N 筆 —— by_class 可能有幾十個,全列出來會淹掉卡片', () => {
    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`c${i}`, 30 - i]),
    )

    expect(bulkBreakdown(many, translate, 20)).toHaveLength(20)
  })

  it('沒有分組時回傳空陣列', () => {
    expect(bulkBreakdown({}, translate)).toEqual([])
  })
})
