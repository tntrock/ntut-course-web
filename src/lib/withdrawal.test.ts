import { describe, expect, it } from 'vitest'
import {
  courseRows,
  mergeSummaries,
  rateGroups,
  sortRows,
  summarizeSemester,
  teacherRows,
  withdrawalStats,
  withdrawalRate,
  type Row,
} from './withdrawal'
import { course } from '@/test/factories'

describe('withdrawalRate', () => {
  it('分母是「人 + 撤」', () => {
    // 「人」是目前選課人數,撤選的已經扣掉了 —— 原始修課人次要把撤選的加回來。
    // 用「撤 / 人」會高估:17/47 是 36.2%,17/30 卻變成 56.7%
    expect(withdrawalRate(30, 17)).toBeCloseTo(17 / 47)
  })

  it('沒有人修課時是 0,不是 NaN', () => {
    expect(withdrawalRate(0, 0)).toBe(0)
  })

  it('欄位是 null 時當成 0', () => {
    // 舊學期偶爾整欄空白
    expect(withdrawalRate(null, null)).toBe(0)
    expect(withdrawalRate(null, 3)).toBe(1)
  })
})

describe('summarizeSemester', () => {
  it('依教師代碼彙總,不是姓名', () => {
    // 實測有同名老師,用姓名會把兩個人的課混在一起
    const s = summarizeSemester('114-2', [
      course({
        id: '1',
        teachers: ['陳志明'],
        teacher_codes: ['A'],
        enrolled: 40,
        withdrawn: 10,
      }),
      course({
        id: '2',
        teachers: ['陳志明'],
        teacher_codes: ['B'],
        enrolled: 30,
        withdrawn: 20,
      }),
    ])
    expect(s.teachers.map((t) => t.code)).toEqual(['A', 'B'])
  })

  it('合開的課算進每一位老師', () => {
    // 人數無法拆分,所以兩位都記整份。比率仍然正確(分子分母一起放大)
    const s = summarizeSemester('114-2', [
      course({
        id: '1',
        teachers: ['甲', '乙'],
        teacher_codes: ['A', 'B'],
        enrolled: 40,
        withdrawn: 10,
      }),
    ])
    expect(s.teachers.map((t) => t.code)).toEqual(['A', 'B'])
    expect(teacherRows(mergeSummaries([s]), 0)[0]?.rate).toBeCloseTo(10 / 50)
  })

  it('沒有教師代碼的課不進教師彙總,但仍留在課程列', () => {
    // 教師「未定」的課還是要看得到,只是沒有人可以歸屬
    const s = summarizeSemester('114-2', [
      course({ id: '1', teacher_codes: [], enrolled: 40, withdrawn: 10 }),
    ])
    expect(s.teachers).toEqual([])
    expect(s.courses).toHaveLength(1)
  })

  it('教師姓名直接取自索引，不必再拉 teachers.json', () => {
    // 實測 3 個學期 7,956 組 teacher_codes[i] ↔ teachers[i] 全部對得上，
    // 省掉每學期 89 KB —— 跨 40 個學期就是 3.5 MB
    const s = summarizeSemester('114-2', [
      course({
        id: '1',
        teachers: ['古碧源'],
        teacher_codes: ['A'],
        enrolled: 40,
        withdrawn: 10,
      }),
    ])
    expect(s.teachers).toEqual([
      expect.objectContaining({
        code: 'A',
        name: '古碧源',
        enrolled: 40,
        withdrawn: 10,
      }),
    ])
  })

  it('姓名數量對不上時退回代碼，不留空白', () => {
    const s = summarizeSemester('114-2', [
      course({
        id: '1',
        teachers: [],
        teacher_codes: ['A'],
        enrolled: 40,
        withdrawn: 10,
      }),
    ])
    expect(s.teachers[0]?.name).toBe('A')
  })

  it('只留有人撤選的課，其餘丟掉', () => {
    // 40 個學期 × 3,000 門全留在記憶體裡是 120,000 筆。有撤選的只有約 700 門
    const s = summarizeSemester('114-2', [
      course({ id: '1', enrolled: 40, withdrawn: 10 }),
      course({ id: '2', enrolled: 40, withdrawn: 0 }),
    ])
    expect(s.courses.map((c) => c.id)).toEqual(['1'])
  })

  it('教師則要全部留著，沒撤選的課也算進分母', () => {
    const s = summarizeSemester('114-2', [
      course({ id: '1', teacher_codes: ['A'], enrolled: 40, withdrawn: 10 }),
      course({ id: '2', teacher_codes: ['A'], enrolled: 60, withdrawn: 0 }),
    ])
    expect(s.teachers[0]).toMatchObject({
      enrolled: 100,
      withdrawn: 10,
      courseCount: 2,
    })
  })

  it('記下哪幾門課造成撤選，比率才有脈絡可讀', () => {
    const s = summarizeSemester('114-2', [
      course({
        id: '1',
        name_zh: '工程力學',
        teacher_codes: ['A'],
        enrolled: 40,
        withdrawn: 10,
      }),
      course({
        id: '2',
        name_zh: '微積分',
        teacher_codes: ['A'],
        enrolled: 60,
        withdrawn: 0,
      }),
    ])
    expect(s.teachers[0]?.withdrawnCourses).toEqual(['工程力學'])
  })

  it('欄位整個不存在的舊學期也要標成沒有資料', () => {
    // 90-1 ~ 95-2 的索引沒有 enrolled / withdrawn 這兩個鍵,不是 null。
    // 用 `!== null` 判斷會讓 undefined 溜過去,11 個空學期被算進「51 個學期」
    const bare = course({ id: '1' })
    delete (bare as { enrolled?: unknown }).enrolled
    delete (bare as { withdrawn?: unknown }).withdrawn
    expect(summarizeSemester('90-1', [bare]).hasData).toBe(false)
  })

  it('整欄空白的舊學期標成沒有資料', () => {
    // 95-1 以前的原始頁面根本沒有「人」「撤」兩欄
    const s = summarizeSemester('95-1', [
      course({ id: '1', enrolled: null, withdrawn: null }),
    ])
    expect(s.hasData).toBe(false)
    expect(summarizeSemester('114-2', [course({ enrolled: 40 })]).hasData).toBe(true)
  })

  it('課程列帶上學期，跨學期時才知道是哪一次開課', () => {
    const s = summarizeSemester('113-1', [
      course({ id: '1', enrolled: 40, withdrawn: 10 }),
    ])
    expect(s.courses[0]?.semester).toBe('113-1')
  })
})

describe('mergeSummaries', () => {
  const a = summarizeSemester('114-2', [
    course({
      id: '1',
      name_zh: '工程力學',
      teachers: ['古碧源'],
      teacher_codes: ['A'],
      enrolled: 30,
      withdrawn: 10,
    }),
  ])
  const b = summarizeSemester('114-1', [
    course({
      id: '2',
      name_zh: '電子學',
      teachers: ['古碧源'],
      teacher_codes: ['A'],
      enrolled: 70,
      withdrawn: 0,
    }),
  ])

  it('同一位老師跨學期加總', () => {
    const m = mergeSummaries([a, b])
    expect(m.teachers[0]).toMatchObject({
      code: 'A',
      enrolled: 100,
      withdrawn: 10,
      courseCount: 2,
    })
  })

  it('課程不跨學期合併 —— 課號每學期都不一樣，合了就是假的', () => {
    const m = mergeSummaries([a, b])
    expect(m.courses).toHaveLength(1)
    expect(m.courses[0]?.semester).toBe('114-2')
  })

  it('沒有資料的學期不算進涵蓋範圍', () => {
    const old = summarizeSemester('95-1', [course({ enrolled: null, withdrawn: null })])
    const m = mergeSummaries([a, old])
    expect(m.semesters).toEqual(['114-2'])
    expect(m.skipped).toEqual(['95-1'])
  })
})

describe('withdrawalStats', () => {
  it('平均、標準差與四分位數', () => {
    const s = withdrawalStats([0.01, 0.02, 0.03, 0.04, 0.05])
    expect(s.mean).toBeCloseTo(0.03)
    expect(s.p50).toBeCloseTo(0.03)
    expect(s.sd).toBeCloseTo(0.014142, 4)
  })

  it('空陣列不要變成 NaN', () => {
    expect(withdrawalStats([])).toMatchObject({ n: 0, mean: 0, sd: 0, p50: 0 })
  })
})

describe('rateGroups', () => {
  it('明顯偏高的門檻是平均加一個標準差', () => {
    const rows = [0.5, 0.03, 0.02, 0.01, 0.005].map((rate, i) => ({
      key: String(i),
      name: String(i),
      rate,
      enrolled: 100,
      withdrawn: 1,
      base: 101,
      detail: [],
    }))
    const stats = withdrawalStats(rows.map((r) => r.rate))
    const groups = rateGroups(rows, stats)
    expect(groups[0]?.rows.map((r) => r.key)).toEqual(['0'])
    expect(groups[0]?.label).toContain('明顯偏高')
  })

  it('每一組都要標出門檻，不然分組只是無法解釋的色塊', () => {
    const rows = [0.5, 0.03, 0.01].map((rate, i) => ({
      key: String(i),
      name: String(i),
      rate,
      enrolled: 100,
      withdrawn: 1,
      base: 101,
      detail: [],
    }))
    const groups = rateGroups(rows, withdrawalStats(rows.map((r) => r.rate)))
    for (const g of groups) expect(g.hint).toMatch(/%/)
  })

  it('沒有資料時不要吐出三個空組', () => {
    expect(rateGroups([], withdrawalStats([]))).toEqual([])
  })
})

describe('sortRows', () => {
  const rows = [
    {
      key: 'a',
      name: '陳',
      rate: 0.1,
      withdrawn: 5,
      base: 50,
      enrolled: 45,
      detail: [],
    },
    {
      key: 'b',
      name: '林',
      rate: 0.2,
      withdrawn: 2,
      base: 10,
      enrolled: 8,
      detail: [],
    },
  ]

  it('退選率高到低', () => {
    expect(sortRows(rows, 'rate-desc').map((r) => r.key)).toEqual(['b', 'a'])
  })

  it('退選率低到高', () => {
    expect(sortRows(rows, 'rate-asc').map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('退選人數多到少', () => {
    expect(sortRows(rows, 'withdrawn').map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('原始人次多到少', () => {
    expect(sortRows(rows, 'base').map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('姓名', () => {
    expect(sortRows(rows, 'name').map((r) => r.key)).toEqual(['b', 'a'])
  })

  it('不改動輸入陣列', () => {
    sortRows(rows, 'rate-asc')
    expect(rows.map((r) => r.key)).toEqual(['a', 'b'])
  })
})

describe('教師列的連結學期', () => {
  /**
   * 退選率頁彙總好幾個學期,但連結原本一律指向「畫面上選的那個學期」。
   * 實測前 100 名有 **46 位**在 115-1 根本沒開課(連第 1 名侯政伯也是),
   * 點進去就是「查無此教師」。要連到這位老師最近真的有開課的那個學期。
   */
  const merged = mergeSummaries([
    summarizeSemester('115-1', [
      course({
        id: '9',
        teachers: ['乙'],
        teacher_codes: ['B'],
        enrolled: 40,
        withdrawn: 10,
      }),
    ]),
    summarizeSemester('114-1', [
      course({
        id: '1',
        teachers: ['甲'],
        teacher_codes: ['A'],
        enrolled: 30,
        withdrawn: 10,
      }),
    ]),
    summarizeSemester('113-1', [
      course({
        id: '2',
        teachers: ['甲'],
        teacher_codes: ['A'],
        enrolled: 30,
        withdrawn: 5,
      }),
    ]),
  ])

  it('連到最近有開課的學期,不是最舊的', () => {
    expect(teacherRows(merged, 0).find((r) => r.key === 'A')?.linkSemester).toBe(
      '114-1',
    )
  })

  it('只出現在一個學期的老師就連那個學期', () => {
    expect(teacherRows(merged, 0).find((r) => r.key === 'B')?.linkSemester).toBe(
      '115-1',
    )
  })

  it('教師列不標學期 —— 那是跨學期的合計,標一個學期會被讀成「只開過那學期」', () => {
    expect(teacherRows(merged, 0).find((r) => r.key === 'A')?.semester).toBeUndefined()
  })
})

describe('teacherRows / courseRows', () => {
  const merged = mergeSummaries([
    summarizeSemester('114-2', [
      course({
        id: '1',
        name_zh: '工程力學',
        teachers: ['古碧源'],
        teacher_codes: ['A'],
        enrolled: 30,
        withdrawn: 17,
      }),
      course({
        id: '2',
        name_zh: '小班課',
        teachers: ['吳亦超'],
        teacher_codes: ['B'],
        enrolled: 3,
        withdrawn: 2,
      }),
    ]),
  ])

  const byKey = (rows: Row[], key: string) => rows.find((r) => r.key === key)

  it('分母是人 + 撤', () => {
    expect(byKey(teacherRows(merged, 0), 'A')?.rate).toBeCloseTo(17 / 47)
  })

  it('門檻擋掉小樣本', () => {
    // 「3 人修、2 人撤 = 40%」不是訊號,是雜訊
    expect(teacherRows(merged, 30).map((r) => r.key)).toEqual(['A'])
  })

  it('門檻看的是彙總後的人次,不是單門課', () => {
    const m = mergeSummaries([
      summarizeSemester('114-2', [
        course({ id: '1', teacher_codes: ['A'], enrolled: 20, withdrawn: 5 }),
        course({ id: '2', teacher_codes: ['A'], enrolled: 20, withdrawn: 5 }),
      ]),
    ])
    expect(teacherRows(m, 50)).toHaveLength(1)
    expect(teacherRows(m, 51)).toEqual([])
  })

  it('課程列帶得出老師，教師列帶得出課程', () => {
    expect(byKey(courseRows(merged, 0), '1')?.detail).toEqual(['古碧源'])
    expect(byKey(teacherRows(merged, 0), 'A')?.detail).toEqual(['工程力學'])
  })
})
