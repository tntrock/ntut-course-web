import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { Timetable } from './Timetable'
import type { Day } from '@/types/api'
import { courseItem, eventItem } from '@/lib/schedule'
import { newEvent } from '@/lib/events'
import { renderInRouter } from '@/test/renderRoute'
import { PERIODS, savedCourse, slot } from '@/test/factories'

const calculus = savedCourse({
  id: '1',
  name_zh: '微積分',
  time_slots: [slot(1, '1', '2')],
  classrooms: ['共同101'],
})
const job = newEvent('打工', [slot(2, '3')], '便利商店')

function renderTable(conflictKeys: string[] = [], days: readonly Day[] = [1, 2]) {
  const items = [courseItem(calculus), eventItem(job)]
  renderInRouter(
    <Timetable
      items={items}
      periods={PERIODS}
      semester="115-1"
      days={days}
      conflictKeys={new Set(conflictKeys)}
    />,
  )
}

describe('Timetable', () => {
  it('課程是連到課程頁的連結,並帶出教室', async () => {
    renderTable()
    const link = await waitFor(() => screen.getByRole('link', { name: /微積分/ }))
    expect(link).toHaveAttribute('href', '/course/115-1/1')
    expect(link.textContent).toContain('共同101')
  })

  it('個人事務不是連結 —— 它沒有課程頁可以去', async () => {
    renderTable()
    const title = await waitFor(() => screen.getByText('打工'))
    expect(title.closest('a')).toBeNull()
    expect(screen.getByText('便利商店')).toBeInTheDocument()
  })

  it('衝堂的課程與事務都標紅', async () => {
    renderTable([`course:${calculus.id}`, `event:${job.id}`])
    const link = await waitFor(() => screen.getByRole('link', { name: /微積分/ }))
    expect(link.className).toContain('text-destructive')
    expect(screen.getByText('打工').parentElement?.className).toContain(
      'text-destructive',
    )
  })

  it('沒有欄位的那天不畫 —— 不讓它落到錯的欄位', async () => {
    renderTable([], [1])
    await waitFor(() => screen.getByRole('link', { name: /微積分/ }))
    expect(screen.queryByText('打工')).toBeNull()
  })
})
