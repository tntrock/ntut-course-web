import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { RankRow } from './withdrawal/RankRow'
import { StatsBar } from './withdrawal/StatsBar'
import { CourseCard } from './search/CourseCard'
import { FilterPanel } from './search/FilterPanel'
import { renderInRouter } from '@/test/renderRoute'
import { course } from '@/test/factories'
import { DEPARTMENTS } from '@/test/fixtures'
import type { Row } from '@/lib/withdrawal'

/** 幾個純顯示元件在資料缺漏、邊界數量時的樣子。 */

const STATS = { n: 0, mean: 0, sd: 0, p25: 0, p50: 0, p75: 0 }

describe('StatsBar', () => {
  it.each([
    [[], '沒有資料'],
    [['115-1'], '115-1'],
    [['115-1', '114-2', '114-1'], '3 個學期・114-1 – 115-1'],
  ])('期間 %j 寫成「%s」', (semesters, span) => {
    render(
      <StatsBar
        stats={STATS}
        enrolled={0}
        withdrawn={0}
        semesters={semesters}
        unit="門課"
      />,
    )
    expect(screen.getByText(span)).toBeInTheDocument()
    // 分母是 0 時不能顯示 NaN%
    expect(screen.getAllByText('0.00%').length).toBeGreaterThan(0)
  })
})

describe('RankRow', () => {
  const row = (overrides: Partial<Row> = {}): Row => ({
    key: '1',
    name: '作業系統',
    rate: 0.1,
    enrolled: 90,
    withdrawn: 10,
    base: 100,
    detail: [],
    ...overrides,
  })

  it('沒有細節時寫「未定」,超過三筆只列前三並標出總數', async () => {
    renderInRouter(
      <>
        <RankRow
          row={row()}
          rank={null}
          semester="115-1"
          kind="course"
          showSemester
          range="y3"
        />
        <RankRow
          row={row({ key: '2', name: '王小明', detail: ['甲', '乙', '丙', '丁'] })}
          rank={1}
          semester="115-1"
          kind="teacher"
          showSemester
          range="y3"
        />
      </>,
    )
    expect(await screen.findByText('未定')).toBeInTheDocument()
    expect(screen.getByText('甲、乙、丙 等 4 門')).toBeInTheDocument()
    // 課程列沒有自己的學期時,連到頁面目前的學期
    expect(screen.getByRole('link', { name: /作業系統/ })).toHaveAttribute(
      'href',
      '/course/115-1/1',
    )
  })

  it('跨學期時課程列標出是哪一次開課', async () => {
    renderInRouter(
      <RankRow
        row={row({ semester: '114-2' })}
        rank={null}
        semester="115-1"
        kind="course"
        showSemester
        range="y3"
      />,
    )
    expect(await screen.findByText('114-2')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/course/114-2/1')
  })
})

describe('CourseCard', () => {
  it('沒有教師、沒有學分、沒有修課人數時不留空徽章', async () => {
    renderInRouter(
      <CourseCard
        course={course({
          teachers: [],
          credits: null,
          enrolled: 0,
          requirement_type: null,
        })}
        semester="115-1"
        periods={[]}
      />,
    )
    expect(await screen.findByText('未定')).toBeInTheDocument()
    expect(screen.queryByText(/學分/)).toBeNull()
    expect(screen.queryByText(/修課/)).toBeNull()
  })
})

describe('FilterPanel', () => {
  it('沒有必選修類別、學分不明的課不影響選項;清空最高學分回到不限', () => {
    const onChange = vi.fn()
    render(
      <FilterPanel
        courses={[course({ requirement_type: null, credits: null })]}
        departments={DEPARTMENTS as never}
        periods={[]}
        values={{
          dept: [],
          req: [],
          lang: [],
          slot: [],
          time: 'includes',
          cmin: undefined,
          cmax: 3,
        }}
        onChange={onChange}
        onClear={() => {}}
      />,
    )
    expect(screen.getByLabelText('最高學分')).toHaveAttribute('max', '0')
    fireEvent.change(screen.getByLabelText('最高學分'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ cmax: undefined })
  })
})
