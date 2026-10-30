import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { CourseInfo } from './CourseInfo'
import { renderInRouter, stubApi } from '@/test/renderRoute'
import { BASE_API, META, fullCourse } from '@/test/fixtures'
import { slot } from '@/test/factories'
import type { Course, Meta } from '@/types/api'

afterEach(() => vi.unstubAllGlobals())

const SNAPSHOT = {
  semester: '115-1',
  year: 115,
  sem: 1,
  date: '2026-09-08',
  at: '2026-09-08T00:00:00Z',
  course_count: 1,
  enrolled_total: 0,
  withdrawn_total: 0,
  path: '',
}

function renderInfo(course: Course, capacity?: Map<string, number | null>) {
  stubApi({
    ...BASE_API,
    'enrollment.json': { schema_version: 3, snapshot_count: 1, snapshots: [SNAPSHOT] },
    '115-1/enrollment/2026-09-08.json': {
      ...SNAPSHOT,
      schema_version: 3,
      courses: [{ id: '1', enrolled: 42, withdrawn: 3 }],
    },
  })
  renderInRouter(
    <CourseInfo
      course={course}
      semester="115-1"
      meta={META as unknown as Meta}
      deptName={new Map([['59', '資工系']])}
      capacity={capacity}
    />,
  )
}

describe('CourseInfo', () => {
  it('完整的課:教師、班級、教室與座位數、學程、附註都連到對應的頁面', async () => {
    renderInfo(
      {
        ...fullCourse({
          id: '1',
          teachers: ['王小明', '外聘'],
          teacher_codes: ['t1'],
          department_ids: ['59', 'ZZ'],
          class_ids: ['2501'],
          time_slots: [slot(1, '1')],
          enrolled: 40,
          withdrawn: 2,
        }),
        classes: ['資工一甲', '合開班'],
        classrooms: ['三教101', '戶外'],
        classroom_codes: ['r1'],
        programs: ['人工智慧學程'],
        audit: '可隨班附讀',
        lab: '每週三小時',
      },
      new Map([['r1', 60]]),
    )

    expect(await screen.findByRole('link', { name: '王小明' })).toHaveAttribute(
      'href',
      '/teacher/115-1/t1',
    )
    // 沒有代碼的就只顯示名字,不給一個連不到的連結
    expect(screen.queryByRole('link', { name: '外聘' })).toBeNull()
    expect(screen.getByRole('link', { name: '資工系' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ZZ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '資工一甲' })).toHaveAttribute(
      'href',
      '/class/115-1/2501',
    )
    expect(screen.queryByRole('link', { name: '合開班' })).toBeNull()
    expect(screen.getByRole('link', { name: '三教101' })).toBeInTheDocument()
    expect(screen.getByText('60 人')).toBeInTheDocument()
    expect(screen.getByText('戶外')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '人工智慧學程' })).toBeInTheDocument()
    expect(screen.getByText('可隨班附讀')).toBeInTheDocument()
    expect(screen.getByText('每週三小時')).toBeInTheDocument()
    expect(screen.getByText(/撤選 2 人/)).toBeInTheDocument()
    expect(screen.getByText('08:10–09:00')).toBeInTheDocument()

    // 逐日快照到了才出現「近日人數」
    expect(await screen.findByText('近日人數')).toBeInTheDocument()
  })

  it('資料缺漏時一律降級顯示', async () => {
    const course = fullCourse({ id: '9', teachers: [], time_slots: [], withdrawn: 0 })
    delete (course as { enrolled?: number }).enrolled
    renderInfo(course)

    expect(await screen.findByText('無固定時段')).toBeInTheDocument()
    expect(screen.getByText('未定')).toBeInTheDocument()
    expect(screen.getByText('未提供')).toBeInTheDocument()
    expect(screen.queryByText('班級')).toBeNull()
    expect(screen.queryByText('教室')).toBeNull()
    expect(screen.queryByText('近日人數')).toBeNull()
  })
})
