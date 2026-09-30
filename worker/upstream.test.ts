import { describe, expect, it, vi } from 'vitest'
import { findCourse, parseUpstream } from './upstream.ts'

describe('parseUpstream', () => {
  /**
   * 學校原始資料裡有造字(私用區字元),實測 14 位教師的姓名帶著它。
   * 前端在 `lib/api.ts` 的 fetch 邊界就換掉了;Worker 是另一條取資料的路徑,
   * **同一件事要做兩次** —— 漏掉的話伺服器端產出的 `<title>` 會夾著一個
   * 在別人裝置上顯示成豆腐方塊的字元,而那正是分享卡片會看到的那一份。
   */
  it('把私用區字元換成〇', () => {
    const json = JSON.stringify({ teachers: [{ id: '1', name: '林' }] })
    const out = parseUpstream<{ teachers: { name: string }[] }>(json)
    expect(out.teachers[0]?.name).toBe('林〇')
  })

  it('其餘內容原封不動', () => {
    expect(parseUpstream<{ a: number[] }>('{"a":[1,2,3]}')).toEqual({ a: [1, 2, 3] })
  })
})

/**
 * 課程頁只需要**一門課**,卻得從 942 KB 的學期索引裡找。
 *
 * 整份 `JSON.parse` 在 Worker 上實測每個請求 21–36ms CPU,是免費方案 10ms 上限
 * 的兩到三倍 —— 24 小時內 7,921 個請求被判 `exceededResources`,全部是課程頁。
 * CPU 超限是在 Worker 外面被中止的,`index.ts` 那層 try/catch 接不住,使用者
 * 與 Googlebot 拿到的是 Cloudflare 的 1102 錯誤頁。
 */
describe('findCourse', () => {
  const course = (id: string, extra: object = {}) => ({
    id,
    name_zh: `課程${id}`,
    teachers: ['王'],
    time_slots: [{ day: 1, day_name: '一', periods: ['1'] }],
    ...extra,
  })
  const indexText = (courses: object[]) =>
    JSON.stringify({ schema_version: 3, course_count: courses.length, courses })

  it('找得到那門課', () => {
    const text = indexText([course('111111'), course('364540'), course('999999')])
    expect(findCourse<{ id: string; name_zh: string }>(text, '364540')?.name_zh).toBe(
      '課程364540',
    )
  })

  it('沒有就回傳 undefined', () => {
    expect(findCourse(indexText([course('111111')]), '364540')).toBeUndefined()
  })

  /** 課號是前綴關係時不能認錯 —— `3645` 不是 `364540`。 */
  it('不會被前綴相同的課號騙到', () => {
    const text = indexText([course('364540'), course('3645')])
    expect(findCourse<{ id: string }>(text, '3645')?.id).toBe('3645')
  })

  it('課名裡有大括號或引號也切得對', () => {
    const text = indexText([
      course('1', { name_zh: '資料結構 {進階} "專題"' }),
      course('2'),
    ])
    expect(findCourse<{ id: string; name_zh: string }>(text, '1')?.name_zh).toBe(
      '資料結構 {進階} "專題"',
    )
  })

  it('切出來的那段一樣會換掉造字', () => {
    const text = indexText([course('1', { teachers: ['林'] })])
    expect(findCourse<{ id: string; teachers: string[] }>(text, '1')?.teachers).toEqual(
      ['林〇'],
    )
  })

  /** 上游哪天改了欄位順序,就退回整份解析 —— 慢,但不會答錯。 */
  it('id 不是第一個欄位時仍然找得到', () => {
    const text = JSON.stringify({
      courses: [
        { name_zh: 'A', id: '1' },
        { name_zh: 'B', id: '2' },
      ],
    })
    expect(findCourse<{ id: string; name_zh: string }>(text, '2')?.name_zh).toBe('B')
  })

  /** 這條押住修正本身:只解析那一小段,不是整份。 */
  it('不解析整份索引', () => {
    const many = Array.from({ length: 3000 }, (_, i) => course(String(100000 + i)))
    const text = indexText(many)
    const parse = vi.spyOn(JSON, 'parse')

    findCourse(text, '101500')

    const longest = Math.max(...parse.mock.calls.map(([arg]) => String(arg).length))
    expect(longest).toBeLessThan(1000)
    parse.mockRestore()
  })
})

describe('findCourse — 上游格式變了', () => {
  /** 找不到就回 undefined 的話,每一門課都會悄悄變成「查無此課」。 */
  it('排版過的 JSON(冒號後有空白)仍然找得到', () => {
    const text = JSON.stringify({ courses: [{ id: '1', name_zh: 'A' }] }, null, 2)
    expect(findCourse<{ id: string; name_zh: string }>(text, '1')?.name_zh).toBe('A')
  })

  /** 反過來,緊湊格式裡查不到的課號要快速放棄,不能整份解析。 */
  it('緊湊格式裡不存在的課號不會觸發整份解析', () => {
    const text = JSON.stringify({ courses: [{ id: '1', name_zh: 'A' }] })
    const parse = vi.spyOn(JSON, 'parse')

    expect(findCourse(text, '999999')).toBeUndefined()
    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })
})
