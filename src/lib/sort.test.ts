import { describe, expect, it } from 'vitest'
import { sortCourses } from './sort'
import { course } from '@/test/factories'

describe('sortCourses', () => {
  const courses = [
    course({ id: 'b', name_zh: '乙課程', credits: 2, enrolled: 30 }),
    course({ id: 'a', name_zh: '甲課程', credits: 3, enrolled: 10 }),
    course({ id: 'c', name_zh: '丙課程', credits: 1, enrolled: 20 }),
  ]
  const scores = new Map([
    ['a', 50],
    ['b', 100],
    ['c', 10],
  ])
  const ids = (sort: Parameters<typeof sortCourses>[1]) =>
    sortCourses(courses, sort, scores).map((c) => c.id)

  it('relevance 依分數由高到低', () => {
    expect(ids('relevance')).toEqual(['b', 'a', 'c'])
  })

  it('name 依課名排序', () => {
    const latin = [
      course({ id: 'c', name_zh: 'Calculus' }),
      course({ id: 'a', name_zh: 'Algebra' }),
      course({ id: 'b', name_zh: 'Biology' }),
    ]

    expect(sortCourses(latin, 'name', new Map()).map((x) => x.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('中文課名用筆畫定序,不是 code point 順序', () => {
    // 筆畫:乙(1) < 丙(5) < 甲(5);code point 則是 丙 < 乙 < 甲。
    // 這條測試會抓出「忘了用 localeCompare 而直接比字串」的退化。
    expect(ids('name')).toEqual(['b', 'c', 'a'])
  })

  it('credits 由高到低 —— 找高學分的課是常見需求', () => {
    expect(ids('credits')).toEqual(['a', 'b', 'c'])
  })

  it('enrolled 由高到低', () => {
    expect(ids('enrolled')).toEqual(['b', 'c', 'a'])
  })

  it('不改動傳進來的陣列', () => {
    const original = [...courses]
    sortCourses(courses, 'name', scores)

    expect(courses).toEqual(original)
  })

  it('credits 為 null 的課排在最後,不會被當成 0 插進中間', () => {
    const withNull = [
      course({ id: 'null', credits: null }),
      course({ id: 'zero', credits: 0 }),
      course({ id: 'three', credits: 3 }),
    ]

    expect(sortCourses(withNull, 'credits', new Map()).map((c) => c.id)).toEqual([
      'three',
      'zero',
      'null',
    ])
  })

  it('enrolled 為 null 的課排在最後', () => {
    const withNull = [
      course({ id: 'null', enrolled: null }),
      course({ id: 'zero', enrolled: 0 }),
      course({ id: 'ten', enrolled: 10 }),
    ]

    expect(sortCourses(withNull, 'enrolled', new Map()).map((c) => c.id)).toEqual([
      'ten',
      'zero',
      'null',
    ])
  })

  it('同值時按課名再按課號,結果穩定', () => {
    const tied = [
      course({ id: '2', name_zh: '同名課', credits: 3 }),
      course({ id: '1', name_zh: '同名課', credits: 3 }),
    ]

    expect(sortCourses(tied, 'credits', new Map()).map((c) => c.id)).toEqual(['1', '2'])
  })
})

describe('sortCourses — 缺值與同分', () => {
  it('學分與人數不明的排最後,同分時照課名', () => {
    const list = [
      course({ id: 'x', name_zh: '乙', credits: null, enrolled: null }),
      course({ id: 'y', name_zh: '甲', credits: 2, enrolled: 5 }),
      course({ id: 'z', name_zh: '丙', credits: 2, enrolled: 5 }),
    ]
    const ids = (key: 'credits' | 'enrolled') =>
      sortCourses(list, key, new Map()).map((c) => c.id)
    expect(ids('credits').at(-1)).toBe('x')
    expect(ids('enrolled').at(-1)).toBe('x')
  })

  it('相關度沒有分數的課視為 0 分,同分照課名', () => {
    const list = [
      course({ id: 'p', name_zh: '乙' }),
      course({ id: 'q', name_zh: '甲' }),
    ]
    expect(sortCourses(list, 'relevance', new Map()).map((c) => c.id)).toHaveLength(2)
  })
})
