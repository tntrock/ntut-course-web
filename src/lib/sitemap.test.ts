import { describe, expect, it } from 'vitest'
import {
  SITEMAP_MAX_URLS,
  STATIC_PATHS,
  sitemapEntries,
  sitemapXml,
  type SemesterContent,
} from './sitemap'

const empty: Omit<SemesterContent, 'semester'> = {
  courseIds: [],
  deptIds: [],
  teacherIds: [],
  programNames: [],
}

const semester = (over: Partial<SemesterContent> = {}): SemesterContent => ({
  semester: '115-1',
  ...empty,
  ...over,
})

describe('sitemapEntries', () => {
  it('先列固定頁面,而且不含 noindex 的那幾頁 —— sitemap 說「請收錄」,meta 說「不要」,兩個訊號打架', () => {
    const paths = sitemapEntries([]).map((e) => e.path)
    expect(paths).toEqual([...STATIC_PATHS])
    expect(paths).not.toContain('/search')
    expect(paths).not.toContain('/schedule')
  })

  it('每個學期的課程、系所、教師、學程都列出來', () => {
    const entries = sitemapEntries([
      semester({
        courseIds: ['364540'],
        deptIds: ['59'],
        teacherIds: ['23533'],
        programNames: ['半導體'],
      }),
    ])
    const paths = entries.map((e) => e.path)

    expect(paths).toContain('/course/115-1/364540')
    expect(paths).toContain('/dept/115-1/59')
    expect(paths).toContain('/teacher/115-1/23533')
    // 班級頁、教室頁不收 —— 內容跟系所頁、教師頁重疊,只會搶爬取預算
    expect(paths.some((p) => /^\/class(room)?\//.test(p))).toBe(false)
  })

  it('學程名字要編碼 —— 路由參數就是中文名,原樣塞進 XML 不是合法網址', () => {
    const paths = sitemapEntries([semester({ programNames: ['半導體'] })]).map(
      (e) => e.path,
    )
    expect(paths).toContain('/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94')
  })

  it('重複的路徑只留一個 —— 同一位老師在兩個學期都有課,但網址是逐學期的,不該重複', () => {
    const entries = sitemapEntries([
      semester({ teacherIds: ['23533', '23533'] }),
      semester({ semester: '114-2' }),
    ])
    expect(entries.filter((e) => e.path === '/teacher/115-1/23533')).toHaveLength(1)
  })
})

describe('sitemapXml', () => {
  it('產出合法的 urlset,網址是絕對的', () => {
    const xml = sitemapXml([{ path: '/browse' }])

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('<loc>https://ntut-course.allenyen.net/browse</loc>')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  /** 唯一拿得到的時間每天都變、每筆都一樣,寫了只會讓 Google 不信這份 sitemap。 */
  it('不寫 <lastmod>', () => {
    const xml = sitemapXml(sitemapEntries([semester({ courseIds: ['1'] })]))
    expect(xml).not.toContain('<lastmod>')
  })

  it('跳脫 XML 特殊字元 —— `&` 在路徑裡是合法的,不會被百分比編碼掉', () => {
    const xml = sitemapXml([{ path: '/classroom/115-1/A&B' }])
    expect(xml).toContain(
      '<loc>https://ntut-course.allenyen.net/classroom/115-1/A&amp;B</loc>',
    )
  })

  it('查詢字串在這裡就被丟掉 —— sitemap 只收正規網址', () => {
    expect(sitemapXml([{ path: '/browse?sem=115-1' }])).toContain(
      '<loc>https://ntut-course.allenyen.net/browse</loc>',
    )
  })

  it('超過上限就拒絕 —— 悄悄截斷會讓人以為整站都送出去了', () => {
    const many = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => ({
      path: `/course/115-1/${i}`,
    }))
    expect(() => sitemapXml(many)).toThrow(/50000/)
  })
})
