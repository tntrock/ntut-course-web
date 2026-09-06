import { describe, expect, it } from 'vitest'
import type { SyllabusProgress } from '@/types/api'
import {
  confirmedSyllabusVersion,
  syllabusState,
  syllabusCoverage,
  unknownSyllabusFields,
} from './syllabus'

/**
 * `syllabus.json` 的實測形狀:`semesters[]` 是每學期的覆蓋率,
 * `fetched` 是「學期 → 課號 → 抓取時間」的巢狀對照。
 */
function progress(
  semesters: { semester: string; fetched: number }[],
  fetched: Record<string, Record<string, string>>,
): SyllabusProgress {
  return {
    schema_version: 2,
    generated_at: '2026-09-05T06:41:05Z',
    semesters: semesters.map((s) => ({
      semester: s.semester,
      fetched: s.fetched,
      oldest_fetch: null,
      newest_fetch: null,
      course_count: 2717,
      with_url: s.fetched,
    })),
    fetched,
  }
}

const COVERED = progress([{ semester: '115-1', fetched: 1 }], {
  '115-1': { '364893': '2026-09-05T06:21:43Z' },
})

describe('syllabusState', () => {
  it('學期完全沒有大綱時回報 semester-not-covered', () => {
    // 實測 114-2 與 110-1 的大綱檔全部 404 —— 使用者不該一門一門點進去撞空
    expect(
      syllabusState(COVERED, '114-2', '364893', 'https://aps.ntut.edu.tw/x'),
    ).toEqual({ kind: 'semester-not-covered' })
  })

  it('學期有列出但抓取數為 0 時,一樣是 semester-not-covered', () => {
    const p = progress([{ semester: '114-2', fetched: 0 }], {})
    expect(syllabusState(p, '114-2', '364893', 'https://aps.ntut.edu.tw/x')).toEqual({
      kind: 'semester-not-covered',
    })
  })

  it('syllabus_url 為 null 的課回報 no-syllabus', () => {
    // 115-1 有 808 門(30%)是這種 —— 班週會、體育、跨校選課
    expect(syllabusState(COVERED, '115-1', '360001', null)).toEqual({
      kind: 'no-syllabus',
    })
  })

  it('有大綱連結但 crawler 還沒抓到時回報 pending', () => {
    expect(
      syllabusState(COVERED, '115-1', '360001', 'https://aps.ntut.edu.tw/x'),
    ).toEqual({ kind: 'pending' })
  })

  it('抓到了就回報 available,並帶上該門課的抓取時間當版本號', () => {
    expect(
      syllabusState(COVERED, '115-1', '364893', 'https://aps.ntut.edu.tw/x'),
    ).toEqual({ kind: 'available', version: '2026-09-05T06:21:43Z' })
  })

  it('抓取對照裡有檔案時,即使 syllabus_url 是 null 也照樣顯示', () => {
    // 旗標與實際檔案打架時以檔案為準:檔案在手上,顯示它不會有 404 風險,
    // 而少顯示一份真實存在的大綱是實質損失
    expect(syllabusState(COVERED, '115-1', '364893', null)).toEqual({
      kind: 'available',
      version: '2026-09-05T06:21:43Z',
    })
  })
})

/**
 * 實測 273 份大綱(115-1 的 1/7 抽樣)
 * **沒有任何一份有 `extra`** —— schema v2 根本沒這個欄位。
 *
 * 但那條要求背後的目的是對的:學校加新欄位時我們要看得到。所以改成更廣的做法 ——
 * 列出**所有型別沒宣告的頂層欄位**,`extra` 只是其中一種可能的形式。
 */
describe('unknownSyllabusFields', () => {
  const known = {
    schema_version: 2,
    year: 115,
    sem: 1,
    course_id: '364893',
    course_name: '數位影像處理',
    teachers: ['某老師'],
    department_ids: ['59'],
    url: 'https://aps.ntut.edu.tw/x',
    fetched_at: '2026-09-05T06:21:43Z',
    has_content: true,
    teacher_name: '某老師',
    teacher_email: 'x@ntut.edu.tw',
    updated_at: '2026-08-11T01:00:23Z',
    outline: '教學目標',
    schedule: '進度',
    flexible_learning: null,
    assessment: '評量',
    materials: '教材',
    contact: [],
    extended_resources: [],
    sdgs: [],
    ai_usage: [],
    notes: null,
  }

  it('已知欄位一個都不列出', () => {
    expect(unknownSyllabusFields(known as never)).toEqual([])
  })

  it('學校加了新欄位時列出來,不默默丟掉', () => {
    const withNew = { ...known, industry_link: '產學合作說明' }
    expect(unknownSyllabusFields(withNew as never)).toEqual([
      { key: 'industry_link', value: '產學合作說明' },
    ])
  })

  it('crawler 若改用 extra 收未知欄位,把裡面的攤平列出', () => {
    const withExtra = { ...known, extra: { core_competency: '核心能力對應' } }
    expect(unknownSyllabusFields(withExtra as never)).toEqual([
      { key: 'core_competency', value: '核心能力對應' },
    ])
  })

  it('未知欄位是空值時不列出,免得畫面長出一堆空標題', () => {
    const empty = { ...known, a: null, b: '', c: [], d: '有值' }
    expect(unknownSyllabusFields(empty as never)).toEqual([{ key: 'd', value: '有值' }])
  })
})

/**
 * schema v3(2026-09-05)對 `syllabus.json` 動了兩個地方:
 *
 * 1. `fetched[學期][課號]` 從**時間字串**變成 `{ at: "…" }` 物件
 * 2. 新增 `frozen` —— 已經抓完、不再更新的學期。實測 114-2 / 114-1 / 113-2
 *    都在這裡,而且它們**不在** `fetched` 對照裡
 *
 * 沒有跟上的話,那三個學期的 6,000 多篇大綱在站上全部顯示「尚未收錄」。
 */
function v3(
  semesters: { semester: string; fetched: number }[],
  fetched: Record<string, Record<string, { at: string }>>,
  frozen: Record<string, { fetched: number; with_url: number; at: string }> = {},
): SyllabusProgress {
  return {
    schema_version: 3,
    generated_at: '2026-09-05T12:23:28Z',
    semesters: semesters.map((s) => ({
      semester: s.semester,
      fetched: s.fetched,
      oldest_fetch: null,
      newest_fetch: null,
      course_count: 2717,
      with_url: s.fetched,
    })),
    fetched,
    frozen,
  }
}

describe('syllabusState（schema v3）', () => {
  const URL = 'https://aps.ntut.edu.tw/x'

  const progress = v3(
    [
      { semester: '115-1', fetched: 1909 },
      { semester: '114-2', fetched: 1968 },
    ],
    { '115-1': { '364893': { at: '2026-09-05T06:21:43Z' } } },
    { '114-2': { fetched: 1968, with_url: 1968, at: '2026-09-05T10:40:52Z' } },
  )

  it('抓取時間從物件的 at 取出來當版本號', () => {
    // 直接拿整個物件當版本號會讓網址變成 ?v=[object Object],
    // 檔案還是抓得到,但老師改過的大綱從此永遠取到舊的那份
    expect(syllabusState(progress, '115-1', '364893', URL)).toEqual({
      kind: 'available',
      version: '2026-09-05T06:21:43Z',
    })
  })

  it('已凍結的學期即使不在 fetched 對照裡,大綱一樣看得到', () => {
    // frozen 的 fetched === with_url,代表有連結的課全部抓完了,
    // 所以這裡用 syllabus_url 判斷存在性就夠
    expect(syllabusState(progress, '114-2', '353187', URL)).toEqual({
      kind: 'available',
      version: '2026-09-05T10:40:52Z',
    })
  })

  it('凍結學期裡沒有大綱連結的課,仍然不顯示大綱分頁', () => {
    expect(syllabusState(progress, '114-2', '353187', null)).toEqual({
      kind: 'no-syllabus',
    })
  })

  it('既不在 fetched 也不在 frozen 的學期是「本學期未收錄」', () => {
    expect(syllabusState(progress, '110-1', '300000', URL)).toEqual({
      kind: 'semester-not-covered',
    })
  })

  it('仍然吃得下 v2 的字串形式,爬蟲回退版本時不會壞掉', () => {
    const old = v3([{ semester: '115-1', fetched: 1 }], {
      '115-1': { '364893': '2026-09-05T06:21:43Z' as unknown as { at: string } },
    })

    expect(old && syllabusState(old, '115-1', '364893', URL)).toEqual({
      kind: 'available',
      version: '2026-09-05T06:21:43Z',
    })
  })
})

describe('unknownSyllabusFields（schema v3）', () => {
  it('content_hash 是中繼資料,不能當成課程內容渲染出來', () => {
    // v3 的舊學期記錄多了這個欄位。「渲染所有未知欄位」的設計在這裡吃到
    // 第一個假陽性 —— 使用者會看到一個標題叫 content_hash 的雜湊區塊
    const withHash = {
      schema_version: 3,
      course_id: '353187',
      has_content: true,
      outline: '教學目標',
      content_hash: 'a3f9c1e8b2d4',
    }

    expect(unknownSyllabusFields(withHash as never)).toEqual([])
  })
})

describe('confirmedSyllabusVersion', () => {
  const URL = 'https://aps.ntut.edu.tw/x'
  const progress = v3(
    [
      { semester: '115-1', fetched: 1909 },
      { semester: '114-2', fetched: 1968 },
    ],
    { '115-1': { '364893': { at: '2026-09-05T06:21:43Z' } } },
    { '114-2': { fetched: 1968, with_url: 1968, at: '2026-09-05T10:40:52Z' } },
  )

  it('逐課對照表有的課回傳版本號,路由可以先預取', () => {
    expect(confirmedSyllabusVersion(progress, '115-1', '364893')).toBe(
      '2026-09-05T06:21:43Z',
    )
  })

  it('凍結學期回傳 undefined —— 那裡的存在性要看 syllabus_url', () => {
    // 凍結學期有三成的課沒有大綱連結。光憑「學期凍結了」就預取,
    // 等於對那三成的課發 404,正是驗收條件禁止的事。
    // 這些課由元件在拿到課程物件之後再取,多一個來回換不發錯誤請求
    expect(confirmedSyllabusVersion(progress, '114-2', '353187')).toBeUndefined()
    expect(syllabusState(progress, '114-2', '353187', URL).kind).toBe('available')
  })
})

describe('syllabusCoverage', () => {
  const ORDER = ['115-1', '114-2', '114-1', '113-2', '110-1']

  it('凍結與更新中的學期都算進涵蓋範圍', () => {
    // 實測 115-1 還在更新(逐課列出),114-2 / 114-1 已凍結(只有摘要)
    const p: SyllabusProgress = {
      schema_version: 3,
      generated_at: '2026-09-06T07:24:53Z',
      semesters: [
        {
          semester: '115-1',
          fetched: 2,
          oldest_fetch: null,
          newest_fetch: null,
          course_count: 10,
          with_url: 2,
        },
        {
          semester: '114-2',
          fetched: 5,
          oldest_fetch: null,
          newest_fetch: null,
          course_count: 10,
          with_url: 5,
        },
      ],
      fetched: { '115-1': { a: { at: 'x' }, b: { at: 'y' } } },
      frozen: { '114-2': { fetched: 5, with_url: 5, at: 'z' } },
    }
    expect(syllabusCoverage(p, ORDER)).toEqual({
      semesters: ['115-1', '114-2'],
      oldest: '114-2',
      total: 7,
    })
  })

  it('依 meta 的學期順序排列,而不是物件的鍵順序', () => {
    // 鍵順序不保證 —— 「最舊到哪一期」得照 meta 的排序算
    const p: SyllabusProgress = {
      schema_version: 3,
      generated_at: '2026-09-06T07:24:53Z',
      semesters: [],
      fetched: {},
      frozen: {
        '113-2': { fetched: 1, with_url: 1, at: 'z' },
        '115-1': { fetched: 2, with_url: 2, at: 'z' },
        '114-1': { fetched: 3, with_url: 3, at: 'z' },
      },
    }
    expect(syllabusCoverage(p, ORDER)).toEqual({
      semesters: ['115-1', '114-1', '113-2'],
      oldest: '113-2',
      total: 6,
    })
  })

  it('抓取數為 0 的學期不算涵蓋', () => {
    const p: SyllabusProgress = {
      schema_version: 3,
      generated_at: '2026-09-06T07:24:53Z',
      semesters: [
        {
          semester: '110-1',
          fetched: 0,
          oldest_fetch: null,
          newest_fetch: null,
          course_count: 10,
          with_url: 3,
        },
      ],
      fetched: {},
    }
    expect(syllabusCoverage(p, ORDER)).toEqual({
      semesters: [],
      oldest: null,
      total: 0,
    })
  })

  it('meta 沒列到的學期仍然算進來,不靜默丟掉', () => {
    // 大綱可能領先 meta —— 少報一個學期比多報一個更難察覺
    const p: SyllabusProgress = {
      schema_version: 3,
      generated_at: '2026-09-06T07:24:53Z',
      semesters: [],
      fetched: {},
      frozen: {
        '115-1': { fetched: 1, with_url: 1, at: 'z' },
        '109-2': { fetched: 4, with_url: 4, at: 'z' },
      },
    }
    expect(syllabusCoverage(p, ORDER)).toEqual({
      semesters: ['115-1', '109-2'],
      oldest: '109-2',
      total: 5,
    })
  })
})
