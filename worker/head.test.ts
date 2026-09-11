import { describe, expect, it, vi } from 'vitest'
import { headForPath, type GetJson } from './head.ts'
import type { HeadTags } from '../src/lib/seo.ts'

const titleOf = (tags: HeadTags | null) =>
  tags?.meta.find((m) => 'title' in m)?.title ?? null

const descOf = (tags: HeadTags | null) => {
  const hit = tags?.meta.find((m) => 'name' in m && m.name === 'description')
  return hit && 'content' in hit ? hit.content : null
}

const canonicalOf = (tags: HeadTags | null) =>
  tags?.links.find((l) => l.rel === 'canonical')?.href ?? null

/** 只認得測試裡放進去的那幾個路徑,其餘一律丟例外 —— 抓錯檔案會很明顯。 */
function fakeApi(files: Record<string, unknown>) {
  const fn = vi.fn(async (path: string) => {
    if (!(path in files)) throw new Error(`意外的請求：${path}`)
    return files[path]
  })
  // 測試替身沒辦法真的是泛型的 —— 回傳的型別是由呼叫端的 T 決定的
  return fn as unknown as GetJson & typeof fn
}

const INDEX = {
  '115-1/index.json': {
    courses: [
      {
        id: '364540',
        name_zh: '網路與系統安全',
        teachers: ['林敬皇', '魏銪志'],
        credits: 3,
        required: false,
        class_ids: ['2401'],
      },
    ],
  },
}

describe('headForPath — 固定頁面', () => {
  it('首頁用站台敘述,而且不必抓任何資料', async () => {
    const get = fakeApi({})
    const tags = await headForPath('/', get)

    expect(titleOf(tags)).toBe('北科課程')
    expect(descOf(tags)).toContain('臺北科技大學課程查詢')
    expect(get).not.toHaveBeenCalled()
  })

  it('固定頁面的文案跟前端同一份 —— 兩邊分岔的話沒有人會發現', async () => {
    const tags = await headForPath('/withdrawal', fakeApi({}))
    expect(titleOf(tags)).toBe('退選率｜北科課程')
  })

  it('noindex 的頁面在伺服器端就要標上 —— 不跑 JS 的爬蟲看不到前端那一份', async () => {
    const tags = await headForPath('/search', fakeApi({}))
    const robots = tags?.meta.find((m) => 'name' in m && m.name === 'robots')
    expect(robots && 'content' in robots ? robots.content : null).toBe(
      'noindex, follow',
    )
  })

  it('尾端斜線算同一頁', async () => {
    expect(titleOf(await headForPath('/about/', fakeApi({})))).toBe('關於｜北科課程')
  })

  it('不認得的路徑回傳 null,讓 index.html 原封不動', async () => {
    expect(await headForPath('/nope', fakeApi({}))).toBeNull()
  })
})

describe('headForPath — 課程頁', () => {
  it('從學期索引組出標題與敘述', async () => {
    const tags = await headForPath('/course/115-1/364540', fakeApi(INDEX))

    expect(titleOf(tags)).toBe('網路與系統安全 115-1｜北科課程')
    expect(descOf(tags)).toBe(
      '115-1 學期「網路與系統安全」，由林敬皇、魏銪志開授，3 學分，選修。臺北科技大學課程資訊與教學大綱。',
    )
    expect(canonicalOf(tags)).toBe(
      'https://ntut-course.allenyen.net/course/115-1/364540',
    )
  })

  it('索引裡沒有這門課就回 null —— 亂猜一個標題比沒有標題糟', async () => {
    expect(await headForPath('/course/115-1/999999', fakeApi(INDEX))).toBeNull()
  })
})

describe('headForPath — 其餘動態頁', () => {
  it('教師頁用名字,不是代碼', async () => {
    const tags = await headForPath(
      '/teacher/115-1/23533',
      fakeApi({
        '115-1/teachers.json': { teachers: [{ id: '23533', name: '林〇' }] },
      }),
    )
    expect(titleOf(tags)).toBe('林〇 老師｜北科課程')
  })

  it('系所頁', async () => {
    const tags = await headForPath(
      '/dept/115-1/59',
      fakeApi({
        '115-1/departments.json': { departments: [{ id: '59', name: '資工系' }] },
      }),
    )
    expect(titleOf(tags)).toBe('資工系 115-1｜北科課程')
  })

  it('班級頁', async () => {
    const tags = await headForPath(
      '/class/115-1/2401',
      fakeApi({
        '115-1/classes.json': { classes: [{ id: '2401', name: '資工四' }] },
      }),
    )
    expect(titleOf(tags)).toBe('資工四 115-1｜北科課程')
  })

  it('教室頁', async () => {
    const tags = await headForPath(
      '/classroom/115-1/R123',
      fakeApi({
        '115-1/classrooms.json': { classrooms: [{ id: 'R123', name: '綜科館 123' }] },
      }),
    )
    expect(titleOf(tags)).toBe('綜科館 123 115-1｜北科課程')
  })

  it('學程名字就在網址裡,不必抓資料', async () => {
    const get = fakeApi({})
    const tags = await headForPath('/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94', get)

    expect(titleOf(tags)).toBe('半導體 115-1｜北科課程')
    expect(canonicalOf(tags)).toBe(
      'https://ntut-course.allenyen.net/program/115-1/%E5%8D%8A%E5%B0%8E%E9%AB%94',
    )
    expect(get).not.toHaveBeenCalled()
  })
})

describe('headForPath — 路徑參數是不可信的輸入', () => {
  /**
   * 學期會被接進上游的網址。不擋的話 `/course/..%2F..%2Fsecret/x` 這種東西
   * 會變成打去別的路徑的請求。
   */
  it.each([
    '/course/../../etc/passwd/1',
    '/course/115_1/364540',
    '/teacher/115-1x/1',
    '/dept/%2E%2E%2F/1',
  ])('學期格式不對就直接回 null（%s）', async (path) => {
    const get = fakeApi({})
    expect(await headForPath(path, get)).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('代碼裡有斜線或點也擋掉', async () => {
    const get = fakeApi({})
    expect(await headForPath('/teacher/115-1/..%2Fadmin', get)).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })
})

describe('headForPath — 站台層級的標籤', () => {
  /**
   * 前端不必自己疊(router 會把根路由那組一起算進去),但 Worker 是自己把
   * 標籤畫成字串的。漏掉就等於分享卡片沒有圖也沒有站名。
   */
  it('每一頁都要帶上 og:image 與 og:site_name', async () => {
    for (const path of ['/', '/about', '/course/115-1/364540']) {
      const tags = await headForPath(path, fakeApi(INDEX))
      const props =
        tags?.meta.flatMap((m) => ('property' in m ? [m.property] : [])) ?? []
      expect(props, path).toContain('og:image')
      expect(props, path).toContain('og:site_name')
    }
  })

  it('頁面自己的標題不會被站台預設值蓋掉', async () => {
    const tags = await headForPath('/course/115-1/364540', fakeApi(INDEX))
    expect(titleOf(tags)).toBe('網路與系統安全 115-1｜北科課程')
  })
})
