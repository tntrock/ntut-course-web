import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, COURSE_GRID_CLASS, TAILWIND_SCREENS } from './useColumns'

/**
 * 欄數必須寫兩次:虛擬捲動要在 JS 裡知道欄數(每一欄是一個 lane),而 Tailwind
 * 的 JIT 只認得**字面**的 class 字串,推導不出來。
 *
 * 兩份就會裂。原本靠一句「兩邊改的時候要一起改」的註解守著 —— 註解攔不住任何
 * 東西,這支測試可以。
 */
describe('欄數的兩份定義要一致', () => {
  it('Tailwind class 解析出來的斷點與 BREAKPOINTS 相同', () => {
    const fromClass = new Map<number, number>([[0, 1]])
    for (const token of COURSE_GRID_CLASS.split(' ')) {
      const m = /^(\w+):grid-cols-(\d+)$/.exec(token)
      if (!m) continue
      const [, screen, cols] = m
      const px = TAILWIND_SCREENS[screen as keyof typeof TAILWIND_SCREENS]
      expect(px, `class 用了未知的斷點 ${screen}`).toBeDefined()
      fromClass.set(px, Number(cols))
    }

    const fromJs = new Map(BREAKPOINTS.map((b) => [b.min, b.columns]))
    expect(fromClass).toEqual(fromJs)
  })
})
