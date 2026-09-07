import { describe, expect, it } from 'vitest'
import { hasEnrolment, stageBadge } from './course'

describe('stageBadge', () => {
  it('把 stage 標成「階段」而不是「年級」', () => {
    // 學校原始表頭是「課號 | 課程名稱 | 階段 | 學分 | 時數 | 修 | 教師 | …」,
    // 這一欄叫階段。年級在「班級」那欄(資工四)
    expect(stageBadge('3')).toBe('階段 3')
  })

  it('預設值 1 不顯示', () => {
    // 115-1 實測 2,878 門課裡 2,768 門是 "1"(96%),顯示出來只是每一頁的雜訊
    expect(stageBadge('1')).toBeNull()
  })

  it('沒有值時不顯示', () => {
    expect(stageBadge(null)).toBeNull()
    expect(stageBadge('')).toBeNull()
  })

  it('認不得的值照樣顯示,不要吞掉', () => {
    // 各系所填法不一致(體育專項全是 3、智動的國文是 3/5/7),
    // 不猜語意,學校給什麼就顯示什麼
    expect(stageBadge('7')).toBe('階段 7')
    expect(stageBadge('上')).toBe('階段 上')
  })
})

describe('hasEnrolment', () => {
  it('有人數就是有', () => {
    expect(hasEnrolment({ enrolled: 30 })).toBe(true)
    // 0 人也是「有這個欄位」,不是「未提供」
    expect(hasEnrolment({ enrolled: 0 })).toBe(true)
  })

  it('null 是學校那一格空白', () => {
    expect(hasEnrolment({ enrolled: null })).toBe(false)
  })

  it('整個欄位不存在 —— 96-1 以前的索引根本沒有這兩欄', () => {
    // 只比對 null 的話 undefined 會溜過去,畫面上「修課 N 人」的 N 會整個不見
    expect(hasEnrolment({})).toBe(false)
  })
})
