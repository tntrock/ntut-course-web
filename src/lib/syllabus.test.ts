import { describe, expect, it } from 'vitest'
import type { SyllabusProgress } from '@/types/api'
import { syllabusState, unknownSyllabusFields } from './syllabus'

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
 * plan §3.3 要求「`extra` 欄位要渲染」。實測 273 份大綱(115-1 的 1/7 抽樣)
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
