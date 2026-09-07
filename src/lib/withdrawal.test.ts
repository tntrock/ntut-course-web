import { describe, expect, it } from 'vitest'
import { courseWithdrawals, teacherWithdrawals, withdrawalRate } from './withdrawal'
import { course } from '@/test/factories'

const names = new Map([
  ['A', '古碧源'],
  ['B', '吳亦超'],
])

describe('withdrawalRate', () => {
  it('分母是「人 + 撤」', () => {
    // 「人」是目前選課人數,撤選的已經扣掉了 —— 原始修課人次要把撤選的加回來。
    // 用「撤 / 人」會高估:17/47 是 36.2%,17/30 卻變成 56.7%
    expect(withdrawalRate(30, 17)).toBeCloseTo(17 / 47)
  })

  it('沒有人修課時是 0,不是 NaN', () => {
    expect(withdrawalRate(0, 0)).toBe(0)
  })

  it('沒有人撤選就是 0', () => {
    expect(withdrawalRate(50, 0)).toBe(0)
  })

  it('欄位是 null 時當成 0', () => {
    // 舊學期偶爾整欄空白
    expect(withdrawalRate(null, null)).toBe(0)
    expect(withdrawalRate(null, 3)).toBe(1)
  })
})

describe('courseWithdrawals', () => {
  const courses = [
    course({ id: '1', name_zh: '電子學', enrolled: 44, withdrawn: 21 }),
    course({ id: '2', name_zh: '微積分', enrolled: 98, withdrawn: 2 }),
    course({ id: '3', name_zh: '小班課', enrolled: 3, withdrawn: 2 }),
  ]

  it('由高到低排序', () => {
    expect(courseWithdrawals(courses, 0).map((c) => c.id)).toEqual(['3', '1', '2'])
  })

  it('門檻擋掉小樣本', () => {
    // 「3 人修、2 人撤 = 40%」不是訊號,是雜訊。不擋的話榜首永遠是這種
    expect(courseWithdrawals(courses, 30).map((c) => c.id)).toEqual(['1', '2'])
  })

  it('完全沒人撤選的課不列出來', () => {
    const none = [course({ id: '9', enrolled: 50, withdrawn: 0 })]
    expect(courseWithdrawals(none, 0)).toEqual([])
  })

  it('帶出原始人次,讓讀者自己判斷樣本大小', () => {
    const [top] = courseWithdrawals(courses, 30)
    expect(top).toMatchObject({ withdrawn: 21, base: 65 })
  })
})

describe('teacherWithdrawals', () => {
  it('依教師代碼彙總,不是姓名', () => {
    // 實測有同名老師,用姓名會把兩個人的課混在一起
    const courses = [
      course({ id: '1', teacher_codes: ['A'], enrolled: 40, withdrawn: 10 }),
      course({ id: '2', teacher_codes: ['A'], enrolled: 30, withdrawn: 20 }),
    ]
    const [a] = teacherWithdrawals(courses, names, 0)
    expect(a).toMatchObject({ code: 'A', name: '古碧源', withdrawn: 30, base: 100 })
    expect(a?.courseCount).toBe(2)
  })

  it('合開的課算進每一位老師', () => {
    // 人數無法拆分,所以兩位都記整份。比率仍然正確(分子分母一起放大)
    const courses = [
      course({ id: '1', teacher_codes: ['A', 'B'], enrolled: 40, withdrawn: 10 }),
    ]
    const rows = teacherWithdrawals(courses, names, 0)
    expect(rows.map((r) => r.code).sort()).toEqual(['A', 'B'])
    expect(rows[0]?.rate).toBeCloseTo(0.2)
  })

  it('沒有教師代碼的課跳過', () => {
    // 教師「未定」的課還是會出現在課程分頁,只是沒有人可以歸屬
    const courses = [
      course({ id: '1', teacher_codes: [], enrolled: 40, withdrawn: 10 }),
    ]
    expect(teacherWithdrawals(courses, names, 0)).toEqual([])
  })

  it('查不到姓名時顯示代碼,不要空白', () => {
    const courses = [
      course({ id: '1', teacher_codes: ['Z'], enrolled: 40, withdrawn: 10 }),
    ]
    expect(teacherWithdrawals(courses, names, 0)[0]?.name).toBe('Z')
  })

  it('門檻看的是彙總後的人次', () => {
    const courses = [
      course({ id: '1', teacher_codes: ['A'], enrolled: 20, withdrawn: 5 }),
      course({ id: '2', teacher_codes: ['A'], enrolled: 20, withdrawn: 5 }),
    ]
    // 單門 25 人次不到門檻,合計 50 人次剛好到
    expect(teacherWithdrawals(courses, names, 50)).toHaveLength(1)
    expect(teacherWithdrawals(courses, names, 51)).toEqual([])
  })
})
