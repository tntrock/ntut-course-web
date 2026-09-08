import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EnrollmentHistory } from './EnrollmentHistory'
import type { EnrollmentPoint } from '@/lib/enrollment'

const point = (
  date: string,
  enrolled: number,
  withdrawn = 0,
  change: number | null = null,
): EnrollmentPoint => ({ date, enrolled, withdrawn, change })

describe('EnrollmentHistory', () => {
  it('列出每一天的修課人數,新的在上', () => {
    render(
      <EnrollmentHistory
        series={[point('2026-09-08', 40, 0, 2), point('2026-09-07', 38)]}
      />,
    )
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toContain('09-08')
    expect(items[0]).toContain('修課 40')
    expect(items[1]).toContain('09-07')
  })

  it('沒有變化就不要印一個 0 —— 整欄都是 0 只是雜訊', () => {
    render(<EnrollmentHistory series={[point('2026-09-08', 40, 0, 0)]} />)
    expect(screen.getByRole('listitem').textContent).not.toContain('0 ')
    expect(screen.queryByText('+0')).toBeNull()
  })

  it('增加標 +、減少標 −', () => {
    render(
      <EnrollmentHistory
        series={[point('2026-09-08', 40, 0, 2), point('2026-09-07', 38, 0, -1)]}
      />,
    )
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('沒人撤選就不要印「撤選 0」', () => {
    render(<EnrollmentHistory series={[point('2026-09-08', 40, 0)]} />)
    expect(screen.getByRole('listitem').textContent).not.toContain('撤選')
  })

  it('有人撤選就要印出來', () => {
    render(<EnrollmentHistory series={[point('2026-09-08', 32, 4)]} />)
    expect(screen.getByRole('listitem').textContent).toContain('撤選 4')
  })

  it('沒有資料時什麼都不畫 —— 由呼叫端決定要不要留下標題', () => {
    // 113-1 這種舊學期完全沒有快照。畫出一個空的「近日人數」欄看起來像壞掉
    const { container } = render(<EnrollmentHistory series={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
