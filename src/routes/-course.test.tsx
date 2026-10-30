import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, DEPARTMENTS, SCOPED, fullCourse } from '@/test/fixtures'

/** 課程頁的分頁、徽章、備註與分享。查無此課的情形在 `src/test/routes.test.tsx`。 */

const COURSE = {
  ...fullCourse({
    id: '1',
    name_zh: '作業系統',
    department_ids: ['59'],
    language: '英語',
    required: true,
    requirement_type: '專業必修',
  }),
  stage: '2',
  hours: 4,
  notes: '與資工二合開',
  syllabus_url: 'https://aps.ntut.edu.tw/x',
}

function stub(fetched: Record<string, unknown> = { '1': { at: 'v1' } }) {
  return stubApi({
    ...BASE_API,
    '115-1/index.json': { semester: '115-1', courses: [COURSE] },
    '115-1/departments.json': DEPARTMENTS,
    '115-1/courses/59.json': {
      ...SCOPED,
      department: { id: '59', name: '資工系', college: '電資學院', url: '' },
      course_count: 1,
      courses: [COURSE],
    },
    'syllabus.json': {
      schema_version: 3,
      generated_at: 'x',
      semesters: [],
      fetched: { '115-1': fetched },
    },
    '115-1/syllabus/1.json': {
      schema_version: 3,
      year: 115,
      sem: 1,
      course_id: '1',
      course_name: '作業系統',
      teachers: [],
      department_ids: ['59'],
      url: '',
      fetched_at: '2026-09-05T00:00:00Z',
      has_content: true,
      teacher_name: null,
      teacher_email: null,
      updated_at: null,
      outline: '理解作業系統',
      schedule: null,
      flexible_learning: null,
      assessment: null,
      materials: null,
      contact: [],
      extended_resources: [],
      sdgs: [],
      ai_usage: [],
      notes: null,
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const title = () => screen.findByRole('heading', { name: '作業系統', level: 1 })

describe('/course/$semester/$courseId', () => {
  it('徽章、備註與返回連結', async () => {
    stub()
    renderRoute('/course/115-1/1')
    await title()

    for (const badge of ['專業必修', '英語', '3 學分', '4 小時', '階段 2']) {
      expect(screen.getByText(badge)).toBeInTheDocument()
    }
    expect(screen.getByText('與資工二合開')).toBeInTheDocument()
    // 直接開分享連結時站內沒有上一頁,退回固定連結
    expect(screen.getByRole('link', { name: '← 回搜尋' })).toHaveAttribute(
      'href',
      '/search?sem=115-1',
    )
  })

  it('切到教學大綱分頁再切回來', async () => {
    stub()
    renderRoute('/course/115-1/1')
    await title()

    fireEvent.click(screen.getByRole('tab', { name: '教學大綱' }))
    expect(await screen.findByText('理解作業系統')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '課程資訊' }))
    expect(await screen.findByText('時段')).toBeInTheDocument()
  })

  it('網址直接帶 tab=syllabus 時開在大綱分頁', async () => {
    stub()
    renderRoute('/course/115-1/1?tab=syllabus')
    expect(await screen.findByText('理解作業系統')).toBeInTheDocument()
  })

  it('沒有大綱連結的課不顯示大綱分頁,tab=syllabus 也退回課程資訊', async () => {
    stubApi({
      ...BASE_API,
      '115-1/index.json': {
        semester: '115-1',
        courses: [{ ...COURSE, syllabus_url: null }],
      },
      '115-1/departments.json': DEPARTMENTS,
      '115-1/courses/59.json': {
        ...SCOPED,
        department: { id: '59', name: '資工系', college: '電資學院', url: '' },
        course_count: 1,
        courses: [{ ...COURSE, syllabus_url: null, notes: null }],
      },
      'syllabus.json': {
        schema_version: 3,
        generated_at: 'x',
        semesters: [],
        fetched: {},
      },
    })
    renderRoute('/course/115-1/1?tab=syllabus')
    await title()
    expect(screen.queryByRole('tab', { name: '教學大綱' })).toBeNull()
    expect(screen.getByText('時段')).toBeInTheDocument()
  })

  it('複製連結後短暫顯示「已複製」', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    stub()
    renderRoute('/course/115-1/1')
    await title()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: '複製連結' }))
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByRole('button', { name: '已複製' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('button', { name: '複製連結' })).toBeInTheDocument()
  })
})

describe('課程頁的上一頁', () => {
  it('從站內點進來時,返回改成真正的上一頁', async () => {
    stub()
    renderRoute('/dept/115-1/59')
    await screen.findByRole('heading', { name: '資工系', level: 1 })

    fireEvent.click(screen.getByRole('link', { name: /作業系統/ }))
    await title()
    fireEvent.click(screen.getByRole('button', { name: '← 上一頁' }))
    expect(
      await screen.findByRole('heading', { name: '資工系', level: 1 }),
    ).toBeInTheDocument()
  })
})
