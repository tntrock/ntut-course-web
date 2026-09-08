import { describe, expect, it } from 'vitest'
import { hasPrivateUse, replacePrivateUse, UNKNOWN_CHAR } from './pua'

/**
 * 實測案例:教師 23533 在學校原始頁面上的姓名是 `林` + U+E1B3。
 * 那是**私用區**碼位（學校自己的造字），沒有任何字型畫得出來，
 * 瀏覽器只會顯示一個空的方塊 —— 看起來就像網站壞了。
 */
describe('replacePrivateUse', () => {
  it('把造字換成〇', () => {
    expect(replacePrivateUse('林\uE1B3')).toBe(`林${UNKNOWN_CHAR}`)
  })

  it('整個基本平面私用區都算', () => {
    expect(replacePrivateUse('\uE000\uF8FF')).toBe(UNKNOWN_CHAR + UNKNOWN_CHAR)
  })

  it('補充平面的私用區也要處理', () => {
    // 這兩個是代理對。正規表示式沒有 u 旗標的話會被拆成兩半，換出兩個〇
    expect(replacePrivateUse('\u{F0000}')).toBe(UNKNOWN_CHAR)
    expect(replacePrivateUse('\u{10FFFD}')).toBe(UNKNOWN_CHAR)
  })

  it('正常的中文與英數一個字都不動', () => {
    const name = '胡石政 Keerthana K. B.'
    expect(replacePrivateUse(name)).toBe(name)
  })

  it('私用區的上下界不要多抓', () => {
    // U+DFFF 是代理區尾、U+F900 是相容漢字頭，兩個都不是私用區
    expect(replacePrivateUse('\uF900')).toBe('\uF900')
  })

  it('空值不要爆掉', () => {
    expect(replacePrivateUse('')).toBe('')
  })
})

describe('hasPrivateUse', () => {
  it('認得出造字', () => {
    expect(hasPrivateUse('林\uE1B3')).toBe(true)
  })

  it('一般姓名不算', () => {
    expect(hasPrivateUse('林建仲')).toBe(false)
  })
})
