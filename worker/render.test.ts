import { describe, expect, it } from 'vitest'
import { renderHead } from './render.ts'
import { FALLBACK_ATTR, pageHead } from '../src/lib/seo.ts'

describe('renderHead', () => {
  const html = renderHead(
    pageHead({ subject: '網路與系統安全 115-1', description: '說明。', path: '/x' }),
  )

  it('畫出 title、meta 與 canonical', () => {
    expect(html).toContain('<title')
    expect(html).toContain('網路與系統安全 115-1｜北科課程</title>')
    expect(html).toContain('name="description" content="說明。"')
    expect(html).toContain('rel="canonical"')
  })

  /**
   * 這是整個伺服器端注入能跟前端共存的關鍵。標籤帶著這個屬性,瀏覽器一跑起
   * JS,`dropHeadFallback()` 就會把它們清掉,換成路由層那一份 —— 沒有這個屬性
   * 就會變成同一個 head 裡兩個 title、兩個 description。
   */
  it('每個標籤都帶上後備標記', () => {
    const tags = html.match(/<(title|meta|link)\b/g) ?? []
    const marked = html.match(new RegExp(FALLBACK_ATTR, 'g')) ?? []
    expect(tags.length).toBeGreaterThan(0)
    expect(marked).toHaveLength(tags.length)
  })

  it('跳脫屬性值裡的引號與角括號 —— 課名是學校給的字串,不是我們控制的', () => {
    const out = renderHead(
      pageHead({ subject: '"><script>alert(1)</script>', path: '/x' }),
    )
    expect(out).not.toContain('<script>')
    expect(out).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('跳脫 title 內文', () => {
    const out = renderHead(pageHead({ subject: 'A & B <c>', path: '/x' }))
    expect(out).toContain('A &amp; B &lt;c&gt;｜北科課程</title>')
  })

  it('沒有標籤就回空字串', () => {
    expect(renderHead({ meta: [], links: [] })).toBe('')
  })
})
