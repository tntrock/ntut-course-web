import { describe, expect, it } from 'vitest'
import {
  parseSearch,
  stringifySearch,
  validateSearchParams,
  toFilters,
} from './searchParams'
import { LANGUAGE_ZH } from './filters'

describe('stringifySearch', () => {
  it('陣列用重複 key,不是 JSON —— 網址要讓人看得懂', () => {
    const qs = stringifySearch({ dept: ['59', '31'] })

    expect(qs).toBe('?dept=59&dept=31')
  })

  it('中文值可以正確編碼與還原', () => {
    const qs = stringifySearch({ lang: ['英語'] })

    expect(parseSearch(qs)).toEqual({ lang: ['英語'] })
  })

  it('空陣列與空字串不進網址,避免留下沒有意義的參數', () => {
    expect(stringifySearch({ dept: [], q: '' })).toBe('')
  })

  it('沒有任何參數時回傳空字串,不是單獨一個問號', () => {
    expect(stringifySearch({})).toBe('')
  })

  it('數字與布林照樣序列化', () => {
    expect(stringifySearch({ cmin: 2 })).toBe('?cmin=2')
  })
})

describe('parseSearch', () => {
  it('重複 key 收成陣列', () => {
    expect(parseSearch('?dept=59&dept=31')).toEqual({ dept: ['59', '31'] })
  })

  it('只出現一次的已知陣列參數也收成陣列', () => {
    expect(parseSearch('?dept=59')).toEqual({ dept: ['59'] })
  })

  it('非陣列參數維持單一值', () => {
    expect(parseSearch('?q=白敦文')).toEqual({ q: '白敦文' })
  })

  it('沒有 query string 時回傳空物件', () => {
    expect(parseSearch('')).toEqual({})
    expect(parseSearch('?')).toEqual({})
  })
})

describe('validateSearchParams', () => {
  it('保留認得的參數', () => {
    const result = validateSearchParams({ q: '影像', dept: ['59'] })

    expect(result.q).toBe('影像')
    expect(result.dept).toEqual(['59'])
  })

  it('丟掉不認得的參數,別人亂加的東西不會進到狀態裡', () => {
    const result = validateSearchParams({ q: '影像', evil: '<script>' })

    expect(result).not.toHaveProperty('evil')
  })

  it('時間模式只接受兩個值,其餘退回預設', () => {
    expect(validateSearchParams({ time: 'only' }).time).toBe('only')
    expect(validateSearchParams({ time: '亂打' }).time).toBeUndefined()
  })

  it('排序只接受已知值', () => {
    expect(validateSearchParams({ sort: 'credits' }).sort).toBe('credits')
    expect(validateSearchParams({ sort: 'DROP TABLE' }).sort).toBeUndefined()
  })

  it('學分是數字,不是數字就丟掉而不是變成 NaN', () => {
    expect(validateSearchParams({ cmin: '2' }).cmin).toBe(2)
    expect(validateSearchParams({ cmin: '不是數字' }).cmin).toBeUndefined()
  })

  it('學分為負數時丟掉', () => {
    expect(validateSearchParams({ cmin: '-1' }).cmin).toBeUndefined()
  })

  it('單一字串的陣列參數會被包成陣列', () => {
    expect(validateSearchParams({ dept: '59' }).dept).toEqual(['59'])
  })

  it('時段格式不合的值會被丟掉,字母節次(A~D 夜間)要保留', () => {
    const result = validateSearchParams({ slot: ['5-2', '亂七八糟', '6-A'] })

    expect(result.slot).toEqual(['5-2', '6-A'])
  })

  it('星期超出範圍的時段會被丟掉', () => {
    expect(validateSearchParams({ slot: ['7-2'] }).slot).toBeUndefined()
  })
})

describe('toFilters', () => {
  it('把網址參數轉成篩選狀態', () => {
    const params = validateSearchParams({
      dept: ['59'],
      lang: [LANGUAGE_ZH],
      slot: ['5-2'],
      time: 'only',
      cmin: '2',
      cmax: '3',
    })
    const f = toFilters(params, null)

    expect(f.departments).toEqual(['59'])
    expect(f.languages).toEqual([LANGUAGE_ZH])
    expect(f.slots).toEqual(['5-2'])
    expect(f.timeMode).toBe('only')
    expect(f.creditsMin).toBe(2)
    expect(f.creditsMax).toBe(3)
  })

  it('沒有參數時得到空的篩選狀態', () => {
    const f = toFilters(validateSearchParams({}), null)

    expect(f.departments).toEqual([])
    expect(f.creditsMin).toBeNull()
    expect(f.courseIdSet).toBeNull()
  })

  it('時間模式預設是「包含」', () => {
    expect(toFilters(validateSearchParams({}), null).timeMode).toBe('includes')
  })
})

describe('網址往返', () => {
  it('複製網址到別的地方打開,狀態完全一致', () => {
    const original = {
      q: '白敦文 影像',
      sem: '115-1',
      dept: ['59', '31'],
      lang: ['英語', '中英雙語'],
      slot: ['5-2', '5-3'],
      time: 'only' as const,
      cmin: 2,
      cmax: 3,
      sort: 'credits' as const,
    }

    const restored = validateSearchParams(parseSearch(stringifySearch(original)))

    expect(restored).toEqual(original)
  })
})
