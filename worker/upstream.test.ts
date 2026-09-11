import { describe, expect, it } from 'vitest'
import { parseUpstream } from './upstream.ts'

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
