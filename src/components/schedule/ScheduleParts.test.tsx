import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ChangeList } from './ChangeList'
import { SavedCourseRow } from './SavedCourseRow'
import { ScheduleStats } from './ScheduleStats'
import { updateStore } from '@/hooks/useStore'
import { defaultStore, loadStore } from '@/lib/storage'
import { scheduleStats } from '@/lib/schedule'
import { renderInRouter } from '@/test/renderRoute'
import { PERIODS, course, savedCourse, slot } from '@/test/factories'

const calculus = savedCourse({
  id: '1',
  name_zh: '微積分',
  teachers: ['王老師'],
  time_slots: [slot(1, '1', '2')],
})

beforeEach(() => {
  localStorage.clear()
  const store = defaultStore()
  store.schedules['115-1'] = { courses: [calculus] }
  updateStore(() => store)
})

describe('SavedCourseRow', () => {
  it('列出老師與時段,移除會從課表拿掉', async () => {
    renderInRouter(
      <SavedCourseRow
        course={calculus}
        semester="115-1"
        periods={PERIODS}
        conflicted={false}
      />,
    )
    expect(await screen.findByText(/王老師/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '從課表移除 微積分' }))
    expect(loadStore().schedules['115-1']?.courses).toEqual([])
  })
})

describe('ChangeList', () => {
  it('說明每種異動,並可更新為最新資料', async () => {
    const current = course({ id: '1', name_zh: '微積分(一)', credits: 4 })
    renderInRouter(
      <ChangeList
        semester="115-1"
        periods={PERIODS}
        entries={[
          {
            course: calculus,
            current,
            changes: [
              { kind: 'credits', from: 3, to: 4 },
              { kind: 'time', from: [slot(1, '1', '2')], to: [slot(2, '3')] },
            ],
          },
        ]}
      />,
    )
    expect(await screen.findByText('1 門課有異動')).toBeInTheDocument()
    expect(screen.getByText('學分數已異動 3 → 4、時段已異動')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更新為最新資料' }))
    expect(loadStore().schedules['115-1']?.courses[0]?.snapshot.name_zh).toBe(
      '微積分(一)',
    )
  })

  it('停開的課沒有最新資料可更新', async () => {
    renderInRouter(
      <ChangeList
        semester="115-1"
        periods={PERIODS}
        entries={[
          { course: calculus, current: undefined, changes: [{ kind: 'removed' }] },
        ]}
      />,
    )
    expect(await screen.findByText('此課已停開')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '更新為最新資料' })).toBeNull()
  })
})

describe('ScheduleStats', () => {
  it('學分數不明或未分必選修時要說明,總數才不會看起來算錯', () => {
    const stats = scheduleStats(
      [
        calculus,
        savedCourse({ id: '2', credits: null }),
        savedCourse({ id: '3', credits: 2, required: null, requirement_type: null }),
      ],
      PERIODS,
    )
    render(<ScheduleStats stats={stats} />)
    expect(screen.getByText(/2 學分的課沒有標示必選修/)).toBeInTheDocument()
    expect(screen.getByText(/1 門課沒有提供學分數/)).toBeInTheDocument()
    expect(screen.getByText('最早第 1 節，最晚第 2 節。')).toBeInTheDocument()
  })
})
