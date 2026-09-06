import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyllabusPanel } from './SyllabusPanel'
import type { Syllabus } from '@/types/api'

/**
 * 這支測試存在的理由很具體:**115-1 全部 1,909 份大綱掃過一遍,
 * 沒有任何一份 `has_content` 是 `false`**,也沒有任何一份還沒抓到。
 *
 * 也就是說「教師尚未填寫」與「尚未收錄」這兩個分支,在瀏覽器裡點不出來 ——
 * 這正是單元測試該補上的位置。等哪天真的出現這種課,畫面已經是對的。
 */
function syllabus(overrides: Partial<Syllabus> = {}): Syllabus {
  return {
    schema_version: 2,
    year: 115,
    sem: 1,
    course_id: '364893',
    course_name: '數位影像處理',
    teachers: ['白敦文'],
    department_ids: ['59'],
    url: 'https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=364893',
    fetched_at: '2026-09-05T06:21:43Z',
    has_content: true,
    teacher_name: '白敦文',
    teacher_email: null,
    updated_at: '2026-08-11T01:00:23Z',
    outline: '教學目標的內容',
    schedule: null,
    flexible_learning: null,
    assessment: null,
    materials: null,
    contact: [],
    extended_resources: [],
    sdgs: [],
    ai_usage: [],
    notes: null,
    ...overrides,
  }
}

/** exactOptionalPropertyTypes 下不能塞 undefined,要真的把 key 拿掉。 */
function withoutFetchedAt(): Syllabus {
  const record = syllabus()
  delete (record as { fetched_at?: string }).fetched_at
  return record
}

describe('SyllabusPanel', () => {
  it('大綱檔在但老師沒填時,說明是老師沒填,不是本站漏抓', () => {
    render(
      <SyllabusPanel
        state={{ kind: 'available', version: '2026-09-05T06:21:43Z' }}
        syllabus={syllabus({ has_content: false, outline: null })}
        syllabusUrl="https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=364893"
      />,
    )

    expect(screen.getByText('授課教師尚未填寫大綱')).toBeInTheDocument()
    // 老師沒填時給學校原始頁當退路 —— 那裡的內容可能比我們抓到的新
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=364893',
    )
  })

  it('有大綱連結但還沒抓到時,說法要和「這門課沒有大綱」分得開', () => {
    render(
      <SyllabusPanel
        state={{ kind: 'pending' }}
        syllabus={undefined}
        syllabusUrl="https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=1"
      />,
    )

    // 「還沒抓到」是暫時的,「沒有大綱」是永久的 —— 兩者混用會誤導
    expect(screen.getByText('大綱尚未收錄')).toBeInTheDocument()
    expect(screen.queryByText('這門課沒有教學大綱')).not.toBeInTheDocument()
  })

  it('這門課本來就沒有大綱時不給原始頁連結 —— 那個連結不存在', () => {
    render(
      <SyllabusPanel
        state={{ kind: 'no-syllabus' }}
        syllabus={undefined}
        syllabusUrl={null}
      />,
    )

    expect(screen.getByText('這門課沒有教學大綱')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('本學期未收錄時明講是本站沒收,不是這門課沒有大綱', () => {
    render(
      <SyllabusPanel
        state={{ kind: 'semester-not-covered' }}
        syllabus={undefined}
        syllabusUrl="https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=1"
      />,
    )

    expect(screen.getByText('本學期未收錄教學大綱')).toBeInTheDocument()
  })

  it('大綱還在路上時顯示載入中,不能先說「尚未收錄」再改口', () => {
    // 大綱不擋整頁渲染,所以面板一定會先遇到「還沒拿到」的一刻。
    // 這時說「尚未收錄」是錯的 —— 它會閃一下錯誤訊息再變成內容
    render(
      <SyllabusPanel
        state={{ kind: 'available', version: '2026-09-05T06:21:43Z' }}
        syllabus={undefined}
        syllabusUrl="https://aps.ntut.edu.tw/x"
      />,
    )

    expect(screen.getByText('載入大綱中…')).toBeInTheDocument()
    expect(screen.queryByText('大綱尚未收錄')).not.toBeInTheDocument()
  })

  it('大綱進度還沒回來時也是載入中 —— 狀態根本還算不出來', () => {
    render(<SyllabusPanel state={null} syllabus={undefined} syllabusUrl={null} />)

    expect(screen.getByText('載入大綱中…')).toBeInTheDocument()
  })

  it('已凍結學期沒有 fetched_at 時,不印出「本站抓取」後面一片空白', () => {
    // schema v3 起,凍結學期的大綱記錄不帶 fetched_at
    render(
      <SyllabusPanel
        state={{ kind: 'available', version: '2026-09-05T10:40:52Z' }}
        syllabus={withoutFetchedAt()}
        syllabusUrl="https://aps.ntut.edu.tw/x"
      />,
    )

    expect(screen.getByText(/教師最後更新 2026-08-11/)).toBeInTheDocument()
    expect(screen.queryByText(/本站抓取/)).not.toBeInTheDocument()
  })

  it('有內容時把老師更新時間與本站抓取時間分開標示', () => {
    render(
      <SyllabusPanel
        state={{ kind: 'available', version: '2026-09-05T06:21:43Z' }}
        syllabus={syllabus()}
        syllabusUrl="https://aps.ntut.edu.tw/x"
      />,
    )

    // 兩個時間的意義完全不同,只寫一個「更新時間」會讓人以為老師昨天改過
    expect(screen.getByText(/教師最後更新 2026-08-11/)).toBeInTheDocument()
    expect(screen.getByText(/本站抓取 2026-09-05/)).toBeInTheDocument()
    expect(screen.getByText('教學目標的內容')).toBeInTheDocument()
  })
})
