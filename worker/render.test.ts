import { describe, expect, it } from 'vitest'
import { renderCourseBody, renderHead } from './render.ts'
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

describe('renderCourseBody', () => {
  const course = {
    id: '364540',
    name_zh: '網路<與>系統安全',
    teachers: ['林敬皇', '魏銪志'],
    teacher_codes: ['12345', ''],
    time_slots: [{ day: 2 as const, day_name: '二', periods: ['2', '3'] }],
    credits: 3,
    required: false,
  }

  it('有大綱時畫出課名、教師連結、時段與大綱內文', () => {
    const html = renderCourseBody(course, '115-1', {
      has_content: true,
      outline: '第一行\n第二行',
      schedule: null,
      assessment: '期末報告',
      materials: '  ',
    })
    expect(html).toContain('<h1>網路&lt;與&gt;系統安全</h1>')
    expect(html).toContain('<a href="/teacher/115-1/12345">林敬皇</a>、魏銪志')
    expect(html).toContain('週二 2、3 節')
    expect(html).toContain('<h2>課程大綱</h2>')
    expect(html).toContain('第一行\n第二行')
    expect(html).toContain('<h2>評量方式</h2>')
    // 空的段落不畫標題
    expect(html).not.toContain('課程進度')
    expect(html).not.toContain('教材')
  })

  it('沒有大綱、或老師沒填,只畫課程資訊', () => {
    for (const syllabus of [null, { has_content: false, outline: 'x' } as never]) {
      const html = renderCourseBody(course, '115-1', syllabus)
      expect(html).toContain('<h1>')
      expect(html).not.toContain('<h2>')
    }
  })
})
