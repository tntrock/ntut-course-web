import { describe, expect, it } from 'vitest'
import { applyFilters, emptyFilters, LANGUAGE_ZH, type Filters } from './filters'
import { course, slot } from '@/test/factories'

const filters = (overrides: Partial<Filters> = {}): Filters => ({
  ...emptyFilters(),
  ...overrides,
})

const idsOf = (courses: Parameters<typeof applyFilters>[0], f: Filters) =>
  applyFilters(courses, f).map((c) => c.id)

describe('沒有任何條件時', () => {
  it('全部保留', () => {
    const courses = [course({ id: '1' }), course({ id: '2' })]

    expect(idsOf(courses, filters())).toEqual(['1', '2'])
  })
})

describe('系所篩選', () => {
  const courses = [
    course({ id: '1', department_ids: ['59'] }),
    course({ id: '2', department_ids: ['31'] }),
    course({ id: '3', department_ids: ['59', '31'] }),
  ]

  it('多選是聯集,不是交集', () => {
    expect(idsOf(courses, filters({ departments: ['59'] }))).toEqual(['1', '3'])
    expect(idsOf(courses, filters({ departments: ['59', '31'] }))).toEqual([
      '1',
      '2',
      '3',
    ])
  })
})

describe('必選修篩選', () => {
  const courses = [
    course({ id: 'req', requirement_type: '校訂專業必修', required: true }),
    course({ id: 'elec', requirement_type: '專業選修', required: false }),
    course({ id: 'unknown', requirement_type: null, required: null }),
  ]

  it('比對完整類別,不是必/選兩態', () => {
    expect(idsOf(courses, filters({ requirementTypes: ['專業選修'] }))).toEqual([
      'elec',
    ])
  })

  it('requirement_type 為 null 的課不會被任何類別誤中', () => {
    expect(idsOf(courses, filters({ requirementTypes: ['校訂專業必修'] }))).toEqual([
      'req',
    ])
  })
})

describe('授課語言篩選', () => {
  const courses = [
    course({ id: 'zh', language: null }),
    course({ id: 'en', language: '英語' }),
    course({ id: 'both', language: '中英雙語' }),
  ]

  it('null 代表中文,用 zh 這個值選取', () => {
    expect(idsOf(courses, filters({ languages: [LANGUAGE_ZH] }))).toEqual(['zh'])
  })

  it('英語與中英雙語是兩個不同的值,不能混為一談', () => {
    expect(idsOf(courses, filters({ languages: ['英語'] }))).toEqual(['en'])
    expect(idsOf(courses, filters({ languages: ['中英雙語'] }))).toEqual(['both'])
  })

  it('可以複選', () => {
    expect(idsOf(courses, filters({ languages: ['英語', '中英雙語'] }))).toEqual([
      'en',
      'both',
    ])
  })
})

describe('學分篩選', () => {
  const courses = [
    course({ id: '0credit', credits: 0 }),
    course({ id: '2credit', credits: 2 }),
    course({ id: '3credit', credits: 3 }),
    course({ id: 'nocredit', credits: null }),
  ]

  it('範圍是含端點的', () => {
    expect(idsOf(courses, filters({ creditsMin: 2, creditsMax: 3 }))).toEqual([
      '2credit',
      '3credit',
    ])
  })

  it('學分為 null 的課在有範圍條件時排除 —— 無法判斷是否落在範圍內', () => {
    expect(idsOf(courses, filters({ creditsMin: 0, creditsMax: 10 }))).not.toContain(
      'nocredit',
    )
  })

  it('0 學分不會被當成 null 而漏掉', () => {
    expect(idsOf(courses, filters({ creditsMin: 0, creditsMax: 0 }))).toEqual([
      '0credit',
    ])
  })
})

describe('時段篩選', () => {
  const 週五234 = course({ id: 'fri234', time_slots: [slot(5, '2', '3', '4')] })
  const 週五2 = course({ id: 'fri2', time_slots: [slot(5, '2')] })
  const 週三7 = course({ id: 'wed7', time_slots: [slot(3, '7')] })
  const 跨兩天 = course({
    id: 'twodays',
    time_slots: [slot(5, '2'), slot(3, '7')],
  })
  const 無時段 = course({ id: 'notime', time_slots: [] })
  const courses = [週五234, 週五2, 週三7, 跨兩天, 無時段]

  it('「包含這些時段」只要有一節落在選取範圍就算', () => {
    const f = filters({ slots: ['5-2'], timeMode: 'includes' })

    expect(idsOf(courses, f)).toEqual(['fri234', 'fri2', 'twodays'])
  })

  it('「只在這些時段」要整門課的每一節都落在選取範圍', () => {
    const f = filters({ slots: ['5-2'], timeMode: 'only' })

    // fri234 有 3、4 節跑出範圍;twodays 有週三那節跑出範圍
    expect(idsOf(courses, f)).toEqual(['fri2'])
  })

  it('「只在這些時段」選滿整門課的節次就會納入', () => {
    const f = filters({ slots: ['5-2', '5-3', '5-4'], timeMode: 'only' })

    expect(idsOf(courses, f)).toEqual(['fri234', 'fri2'])
  })

  it('格子是獨立的,不會變成星期與節次的交叉乘積', () => {
    // 選「週五第2節」與「週三第7節」,不該把「週五第7節」也算進來
    const 週五7 = course({ id: 'fri7', time_slots: [slot(5, '7')] })
    const f = filters({ slots: ['5-2', '3-7'], timeMode: 'includes' })

    expect(idsOf([...courses, 週五7], f)).not.toContain('fri7')
  })

  it('沒有時段的課在有時間條件時排除 —— 使用者是在挑時間', () => {
    const f = filters({ slots: ['5-2'], timeMode: 'includes' })

    expect(idsOf(courses, f)).not.toContain('notime')
  })

  it('沒有時間條件時,沒有時段的課仍然保留', () => {
    expect(idsOf(courses, filters())).toContain('notime')
  })
})

describe('以課號集合篩選(學程 / 教室)', () => {
  const courses = [course({ id: '1' }), course({ id: '2' }), course({ id: '3' })]

  it('只留下集合裡的課號', () => {
    expect(idsOf(courses, filters({ courseIdSet: new Set(['1', '3']) }))).toEqual([
      '1',
      '3',
    ])
  })

  it('空集合代表沒有任何課符合,不是「不篩選」', () => {
    expect(idsOf(courses, filters({ courseIdSet: new Set() }))).toEqual([])
  })
})

describe('教師與班級篩選', () => {
  const courses = [
    course({ id: '1', teacher_codes: ['12095'], class_ids: ['2915'] }),
    course({ id: '2', teacher_codes: ['99999'], class_ids: ['3011'] }),
  ]

  it('教師用代碼比對,不是姓名 —— 有同名老師', () => {
    expect(idsOf(courses, filters({ teacherCode: '12095' }))).toEqual(['1'])
  })

  it('班級用代碼比對', () => {
    expect(idsOf(courses, filters({ classId: '3011' }))).toEqual(['2'])
  })
})

describe('多個條件同時套用', () => {
  it('條件之間是 AND', () => {
    const courses = [
      course({ id: 'match', department_ids: ['59'], language: '英語' }),
      course({ id: 'deptOnly', department_ids: ['59'], language: null }),
      course({ id: 'langOnly', department_ids: ['31'], language: '英語' }),
    ]
    const f = filters({ departments: ['59'], languages: ['英語'] })

    expect(idsOf(courses, f)).toEqual(['match'])
  })
})
