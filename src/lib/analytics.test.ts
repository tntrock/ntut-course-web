import { describe, expect, it, vi } from 'vitest'
import { createPageViewTracker } from './analytics'

describe('createPageViewTracker', () => {
  it('送出 page_view，帶完整網址與路徑', () => {
    const send = vi.fn()
    createPageViewTracker(send)('https://x.test/course/115-1/364893')

    expect(send).toHaveBeenCalledWith('event', 'page_view', {
      page_location: 'https://x.test/course/115-1/364893',
      page_path: '/course/115-1/364893',
    })
  })

  it('同一個網址不重複送', () => {
    // 路由的 onResolved 在初次載入也會觸發,而 gtag 的 config 已經送過一次。
    // 不擋的話首頁的瀏覽量會是實際的兩倍
    const send = vi.fn()
    const track = createPageViewTracker(send)
    track('https://x.test/')
    track('https://x.test/')

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('只有 query string 不同也算換頁', () => {
    // 搜尋條件全部在網址上,`?q=微積分` 和 `?q=物理` 是兩個不同的查詢
    const send = vi.fn()
    const track = createPageViewTracker(send)
    track('https://x.test/search?q=%E5%BE%AE%E7%A9%8D%E5%88%86')
    track('https://x.test/search?q=%E7%89%A9%E7%90%86')

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith('event', 'page_view', {
      page_location: 'https://x.test/search?q=%E7%89%A9%E7%90%86',
      page_path: '/search?q=%E7%89%A9%E7%90%86',
    })
  })

  it('gtag 不在時安靜跳過,不丟例外', () => {
    // 擋廣告的擴充套件會讓 gtag 根本沒定義。統計掛掉不該讓導頁跟著爆掉
    const track = createPageViewTracker(undefined)
    expect(() => track('https://x.test/')).not.toThrow()
  })

  it('網址壞掉時不丟例外', () => {
    const send = vi.fn()
    expect(() => createPageViewTracker(send)('not a url')).not.toThrow()
  })
})
