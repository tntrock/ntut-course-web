import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { course } from '@/test/factories'

/**
 * **整條路由的測試。**
 *
 * 元件測試看不到 `validateSearch`、`loaderDeps`、loader 的請求排程、
 * `notFound()` 與 `head()` —— 那些只有真的走一次路由才會經過,而那正是
 * 這個站最容易出錯的地方(冷啟動直接開分享連結就是走這條)。
 */

const META = {
  schema_version: 3,
  generated_at: '2026-09-13T00:00:00Z',
  latest: '115-1',
  disclaimer: '測試用免責聲明。',
  source: { name: '測試來源', url: 'https://example.invalid/' },
  semesters: [
    {
      year: 115,
      sem: 1,
      path: '115-1',
      generated_at: '2026-09-13T00:00:00Z',
      partial: false,
      department_count: 1,
      class_group_count: 1,
      course_count: 1,
      merged_course_count: 0,
      failed_department_count: 0,
    },
  ],
  endpoints: [],
  periods: [{ code: '1', start: '08:10', end: '09:00' }],
  requirement_symbols: [],
}

const ENTRY = course({
  id: '364540',
  name_zh: '網路與系統安全',
  teachers: ['王小明'],
  department_ids: ['59'],
  credits: 3,
})

const DEPARTMENTS = {
  semester: '115-1',
  departments: [
    {
      id: '59',
      name: '資工系',
      college: '電資學院',
      url: '',
      class_groups: [],
      course_count: 1,
      path: '115-1/courses/59.json',
    },
  ],
  colleges: [{ name: '電資學院', department_ids: ['59'] }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/course/$semester/$courseId', () => {
  function stub() {
    return stubApi({
      'meta.json': META,
      '115-1/index.json': { semester: '115-1', courses: [ENTRY] },
      '115-1/departments.json': DEPARTMENTS,
      '115-1/courses/59.json': {
        semester: '115-1',
        department: { id: '59', name: '資工系', college: '電資學院', url: '' },
        courses: [
          {
            ...ENTRY,
            name_en: null,
            stage: '1',
            hours: 3,
            classes: ['資工四'],
            classrooms: [],
            classroom_codes: [],
            quota: null,
            syllabus_url: 'https://aps.ntut.edu.tw/x',
            notes: null,
            audit: null,
            lab: null,
            programs: [],
          },
        ],
      },
      // 這門課沒有大綱:`fetched` 裡沒有它,課程頁就不會去抓大綱檔
      'syllabus.json': {
        schema_version: 3,
        generated_at: '2026-09-13T00:00:00Z',
        semesters: [],
        fetched: { '115-1': {} },
      },
      'capacity.json': { schema_version: 3, classroom_count: 0, classrooms: {} },
      'enrollment.json': { schema_version: 3, snapshot_count: 0, snapshots: [] },
    })
  }

  it('把課程渲染出來', async () => {
    stub()
    renderRoute('/course/115-1/364540')

    expect(
      await screen.findByRole('heading', { name: '網路與系統安全', level: 1 }),
    ).toBeInTheDocument()
  })

  /** `head()` 只有走完整條路由才會跑到,這是元件測試碰不到的那一段。 */
  it('分頁標題來自課程本身', async () => {
    stub()
    renderRoute('/course/115-1/364540')

    await screen.findByRole('heading', { name: '網路與系統安全', level: 1 })
    await waitFor(() => {
      expect(document.title).toBe('網路與系統安全 115-1｜北科課程')
    })
  })

  /**
   * 課號不在索引裡時 loader 會 `throw notFound()`。
   *
   * **斷言要能分辨「查無此課」與「取不到資料」。** 一開始只比對
   * `/找不到|查無/`,結果把 `notFound()` 整個拿掉測試照樣綠 —— 因為那時候會
   * 改丟別的例外,落到根路由的錯誤畫面,而那段文字也被鬆散的 regex 吃下去了。
   */
  it('查無此課時顯示專屬的說明,不是通用的錯誤畫面', async () => {
    stub()
    renderRoute('/course/115-1/999999')

    expect(
      await screen.findByRole('heading', { name: '查無此課', level: 1 }),
    ).toBeInTheDocument()
    // 課號跨學期不通用是最常見的原因,那句提示要在
    expect(screen.getByText(/課號在不同學期並不通用/)).toBeInTheDocument()
    expect(screen.queryByText('取不到課程資料')).not.toBeInTheDocument()
  })

  /** 學期不在 `meta.semesters` 裡時,loader 要在打索引請求之前就擋下來。 */
  it('不存在的學期直接擋掉,而且不去抓那個學期的索引', async () => {
    const api = stub()
    renderRoute('/course/199-9/364540')

    expect(
      await screen.findByRole('heading', { name: '查無此課', level: 1 }),
    ).toBeInTheDocument()
    expect(api.calls.some((url) => url.includes('199-9'))).toBe(false)
  })
})
