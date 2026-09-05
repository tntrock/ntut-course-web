import { describe, expect, it } from 'vitest'
import { suggestRelaxations } from './suggest'
import { emptyFilters, type Filters } from './filters'

const filters = (overrides: Partial<Filters> = {}): Filters => ({
  ...emptyFilters(),
  ...overrides,
})

describe('suggestRelaxations', () => {
  it('沒有任何條件時不給建議', () => {
    const result = suggestRelaxations(() => 0, '', filters())

    expect(result).toEqual([])
  })

  it('指出移除哪個條件會有結果', () => {
    const f = filters({ departments: ['59'], languages: ['英語'] })
    // 只有拿掉語言條件才有結果
    const count = (_q: string, next: Filters) => (next.languages.length === 0 ? 12 : 0)

    const result = suggestRelaxations(count, '', f)

    expect(result).toEqual([{ remove: 'languages', count: 12 }])
  })

  it('多個條件都可能有結果時,依結果數由多到少排序', () => {
    const f = filters({ departments: ['59'], languages: ['英語'] })
    const count = (_q: string, next: Filters) => {
      if (next.departments.length === 0) return 5
      if (next.languages.length === 0) return 40
      return 0
    }

    expect(suggestRelaxations(count, '', f)).toEqual([
      { remove: 'languages', count: 40 },
      { remove: 'departments', count: 5 },
    ])
  })

  it('關鍵字也算一個可以移除的條件', () => {
    const f = filters({ departments: ['59'] })
    const count = (q: string) => (q === '' ? 7 : 0)

    expect(suggestRelaxations(count, '不存在的課', f)).toEqual([
      { remove: 'query', count: 7 },
    ])
  })

  it('移除任何單一條件都沒結果時回傳空陣列', () => {
    const f = filters({ departments: ['59'], languages: ['英語'] })

    expect(suggestRelaxations(() => 0, '關鍵字', f)).toEqual([])
  })

  it('學分範圍的上下限一起移除,分開移除沒有意義', () => {
    const f = filters({ creditsMin: 5, creditsMax: 6 })
    const count = (_q: string, next: Filters) =>
      next.creditsMin === null && next.creditsMax === null ? 3 : 0

    expect(suggestRelaxations(count, '', f)).toEqual([{ remove: 'credits', count: 3 }])
  })

  it('時段條件可以被建議移除', () => {
    const f = filters({ slots: ['5-2'], timeMode: 'only' })
    const count = (_q: string, next: Filters) => (next.slots.length === 0 ? 9 : 0)

    expect(suggestRelaxations(count, '', f)).toEqual([{ remove: 'slots', count: 9 }])
  })

  it('不會建議移除沒有套用的條件', () => {
    const f = filters({ departments: ['59'] })
    // 所有情況都有結果 —— 只有實際套用的條件才該出現在建議裡
    const result = suggestRelaxations(() => 99, '', f)

    expect(result.map((r) => r.remove)).toEqual(['departments'])
  })
})
