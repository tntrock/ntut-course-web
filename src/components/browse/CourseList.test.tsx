import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderInRouter } from '@/test/renderRoute'
import { QueryClient } from '@tanstack/react-query'

import { CourseList } from './CourseList'
import { course } from '@/test/factories'
import type { Meta } from '@/types/api'

/**
 * 明細頁一次只看**一個學期**,但頁面上原本沒有任何地方寫出那是哪個學期。
 *
 * 從退選率頁點進來特別容易搞混:那一頁彙總好幾個學期,連結會把人帶到這位老師
 * 最近有開課的學期(可能是 114-1 而不是本學期),落地之後卻看不出來。
 */
function renderList(semester: string) {
  const meta = {
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: 'x' }],
    periods: [{ code: '1', start: '08:10', end: '09:00' }],
  } as unknown as Meta

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['meta'], { data: meta, fromCache: false })

  renderInRouter(
    <CourseList
      courses={[course({ id: '1', name_zh: '工程力學' })]}
      semester={semester}
      periods={meta.periods}
    />,
  )
}

describe('CourseList', () => {
  it('在課程卡片上方標出這是哪個學期', async () => {
    renderList('114-1')
    expect(await waitFor(() => screen.getByText('114-1'))).toBeInTheDocument()
  })

  it('課程數量照常顯示', async () => {
    renderList('114-1')
    const line = await waitFor(() => screen.getByText(/門課/).closest('p'))
    // 「114-1 · 1 門課」—— 學期與數量在同一行
    expect(line?.textContent).toContain('1 門課')
    expect(line?.textContent).toContain('114-1')
  })
})
