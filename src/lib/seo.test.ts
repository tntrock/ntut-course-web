import { describe, expect, it } from 'vitest'
import {
  SITE_NAME,
  canonicalUrl,
  describeCourse,
  mergeHead,
  pageHead,
  pageTitle,
  siteHead,
} from './seo'
import type { Course } from '@/types/api'

/** 從 `head()` 回傳值裡挑出某個 meta 的內容,測試才不必寫一堆 find。 */
function metaOf(head: ReturnType<typeof pageHead>, key: string): string | undefined {
  const hit = head.meta.find((m) => 'name' in m && m.name === key)
  return hit && 'content' in hit ? hit.content : undefined
}

function propOf(head: ReturnType<typeof pageHead>, key: string): string | undefined {
  const hit = head.meta.find((m) => 'property' in m && m.property === key)
  return hit && 'content' in hit ? hit.content : undefined
}

describe('pageTitle', () => {
  it('沒有主題時就是站名', () => {
    expect(pageTitle()).toBe(SITE_NAME)
  })

  it('有主題時掛上站名', () => {
    expect(pageTitle('搜尋課程')).toBe('搜尋課程｜北科課程')
  })

  it('只有空白的主題當成沒有 —— 資料缺欄位時不要產出「｜北科課程」', () => {
    expect(pageTitle('   ')).toBe(SITE_NAME)
  })
})

describe('canonicalUrl', () => {
  it('組成絕對網址 —— canonical 不接受相對路徑', () => {
    expect(canonicalUrl('/course/115-1/364540')).toBe(
      'https://ntut-course.allenyen.net/course/115-1/364540',
    )
  })

  it('根目錄保留斜線', () => {
    expect(canonicalUrl('/')).toBe('https://ntut-course.allenyen.net/')
  })

  it('去掉尾端斜線 —— /browse 與 /browse/ 是同一頁,不能算成兩個網址', () => {
    expect(canonicalUrl('/browse/')).toBe('https://ntut-course.allenyen.net/browse')
  })

  it('丟掉查詢字串 —— ?tab=syllabus 是同一門課的同一頁', () => {
    expect(canonicalUrl('/course/115-1/364540?tab=syllabus')).toBe(
      'https://ntut-course.allenyen.net/course/115-1/364540',
    )
  })

  it('中文路徑要百分比編碼 —— 學程路由的參數就是中文名字', () => {
    expect(canonicalUrl('/program/115-1/半導體')).toBe(
      'https://ntut-course.allenyen.net/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94',
    )
  })

  it('已經編碼過的不重複編碼 —— 路由給的 pathname 本來就是編碼後的', () => {
    expect(canonicalUrl('/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94')).toBe(
      'https://ntut-course.allenyen.net/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94',
    )
  })
})

describe('pageHead', () => {
  const head = pageHead({
    subject: '網路與系統安全 115-1',
    description: '這門課的說明。',
    path: '/course/115-1/364540',
  })

  it('title 掛站名,og:title 不掛 —— og:site_name 已經另外講了一次', () => {
    expect(head.meta.find((m) => 'title' in m)?.title).toBe(
      '網路與系統安全 115-1｜北科課程',
    )
    expect(propOf(head, 'og:title')).toBe('網路與系統安全 115-1')
  })

  it('description 同時給 meta 與 og', () => {
    expect(metaOf(head, 'description')).toBe('這門課的說明。')
    expect(propOf(head, 'og:description')).toBe('這門課的說明。')
  })

  it('canonical 與 og:url 都是絕對網址', () => {
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://ntut-course.allenyen.net/course/115-1/364540',
    })
    expect(propOf(head, 'og:url')).toBe(
      'https://ntut-course.allenyen.net/course/115-1/364540',
    )
  })

  it('預設要被收錄 —— 不出現 robots meta', () => {
    expect(metaOf(head, 'robots')).toBeUndefined()
  })

  it('noindex 時擋收錄但仍允許跟隨連結 —— 搜尋頁本身沒有收錄價值,但它連出去的課程頁有', () => {
    const noindexed = pageHead({ subject: '搜尋課程', path: '/search', noindex: true })
    expect(metaOf(noindexed, 'robots')).toBe('noindex, follow')
  })

  it('不帶 canonical 以外的 link,也不重複站台層級的 meta —— 那些在根路由,重複會被當成兩個標籤', () => {
    expect(head.links).toHaveLength(1)
    expect(propOf(head, 'og:site_name')).toBeUndefined()
    expect(propOf(head, 'og:image')).toBeUndefined()
  })

  it('沒有 description 就整個不給 —— 空字串的 meta 比沒有還糟', () => {
    const bare = pageHead({ subject: '關於', path: '/about' })
    expect(metaOf(bare, 'description')).toBeUndefined()
    expect(propOf(bare, 'og:description')).toBeUndefined()
  })
})

describe('siteHead', () => {
  const head = siteHead()

  it('給站台層級的預設值', () => {
    expect(head.meta.find((m) => 'title' in m)?.title).toBe(SITE_NAME)
    expect(propOf(head, 'og:site_name')).toBe(SITE_NAME)
    expect(propOf(head, 'og:locale')).toBe('zh_TW')
    expect(propOf(head, 'og:image')).toBe(
      'https://ntut-course.allenyen.net/icon-512.png',
    )
    expect(metaOf(head, 'twitter:card')).toBe('summary')
  })

  it('**不給 canonical** —— 根路由每一頁都會被比對到,它的 canonical 會跟子路由的並存', () => {
    expect(head.links ?? []).toHaveLength(0)
    expect(propOf(head, 'og:url')).toBeUndefined()
  })
})

describe('describeCourse', () => {
  const base: Pick<
    Course,
    'name_zh' | 'teachers' | 'credits' | 'classes' | 'required'
  > = {
    name_zh: '網路與系統安全',
    teachers: ['王小明'],
    credits: 3,
    classes: ['資工四'],
    required: false,
  }

  it('把老師、學分、必選修、班級串成一句話', () => {
    expect(describeCourse(base, '115-1')).toBe(
      '115-1 學期「網路與系統安全」，由王小明開授，3 學分，選修，開給資工四。臺北科技大學課程資訊與教學大綱。',
    )
  })

  it('缺的欄位整段跳過 —— 不要留下「null 學分」這種句子', () => {
    expect(
      describeCourse(
        { name_zh: '體育', teachers: [], credits: null, classes: [], required: null },
        '115-1',
      ),
    ).toBe('115-1 學期「體育」。臺北科技大學課程資訊與教學大綱。')
  })

  it('多位老師用頓號 —— 合開的課很常見', () => {
    expect(
      describeCourse({ ...base, teachers: ['王小明', '李小華'] }, '115-1'),
    ).toContain('由王小明、李小華開授')
  })

  it('班級多的時候只列前幾個 —— 通識課開給三十幾個班,全列會把敘述撐爆', () => {
    const many = Array.from({ length: 30 }, (_, i) => `班${i}`)
    const text = describeCourse({ ...base, classes: many }, '115-1')
    expect(text).toContain('開給班0、班1、班2 等 30 個班級')
    expect(text).not.toContain('班3')
  })
})

describe('mergeHead', () => {
  const site = siteHead()
  const page = pageHead({ subject: '關於', description: '說明。', path: '/about' })
  const merged = mergeHead(page, site)

  const prop = (key: string) => {
    const hit = merged.meta.find((m) => 'property' in m && m.property === key)
    return hit && 'content' in hit ? hit.content : undefined
  }

  it('前面的贏 —— 跟 router 的「深層路由優先」同一個規則', () => {
    expect(merged.meta.find((m) => 'title' in m)?.title).toBe('關於｜北科課程')
    expect(prop('og:title')).toBe('關於')
  })

  it('補上只有站台層級才有的那些', () => {
    expect(prop('og:site_name')).toBe('北科課程')
    expect(prop('og:image')).toBe('https://ntut-course.allenyen.net/icon-512.png')
  })

  it('同一個 name/property 只留一個 —— 出現兩次時爬蟲取哪一個是未定義的', () => {
    const keys = merged.meta.map((m) =>
      'title' in m ? 'title' : 'name' in m ? m.name : m.property,
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('link 直接接起來', () => {
    expect(merged.links).toHaveLength(1)
    expect(merged.links[0]?.rel).toBe('canonical')
  })
})
