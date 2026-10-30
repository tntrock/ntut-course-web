import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, DEPARTMENTS, SCOPED, fullCourse } from '@/test/fixtures'
import { course } from '@/test/factories'

/** 教師 / 系所 / 學程 / 教室四種明細頁。班級與課程頁在 `src/test/routes.test.tsx`。 */

const OS = fullCourse({ id: '1', name_zh: '作業系統', department_ids: ['59'] })
const AI = course({ id: '2', name_zh: '機器學習' })

const API = {
  ...BASE_API,
  '115-1/index.json': { semester: '115-1', courses: [OS, AI] },
  '115-1/departments.json': {
    ...DEPARTMENTS,
    departments: [
      {
        ...DEPARTMENTS.departments[0],
        class_groups: [{ id: '2501', name: '資工一甲', url: '' }],
      },
      {
        id: 'C2',
        name: '電資學院',
        college: '電資學院',
        url: '',
        class_groups: [],
        course_count: 0,
        path: '',
      },
    ],
  },
  '115-1/teachers.json': {
    ...SCOPED,
    teacher_count: 1,
    teachers: [
      { id: 't1', name: '王小明', course_count: 1, department_ids: ['59'], path: '' },
    ],
  },
  '115-1/teachers/t1.json': {
    ...SCOPED,
    teacher: {
      id: 't1',
      name: '王小明',
      department_ids: ['59', 'ZZ'],
      url: 'https://x/t1',
    },
    course_count: 1,
    courses: [OS],
  },
  '115-1/courses/59.json': {
    ...SCOPED,
    department: { id: '59', name: '資工系', college: '電資學院', url: 'https://x/59' },
    course_count: 1,
    courses: [OS],
  },
  '115-1/courses/C2.json': {
    ...SCOPED,
    department: { id: 'C2', name: '電資學院', college: '電資學院', url: '' },
    course_count: 0,
    courses: [],
  },
  '115-1/courses/A0.json': {
    ...SCOPED,
    department: { id: 'A0', name: '教務處', college: null, url: '' },
    course_count: 0,
    courses: [],
  },
  '115-1/programs.json': {
    ...SCOPED,
    program_count: 1,
    programs: [{ name: '人工智慧學程', course_count: 2, course_ids: ['2', '999'] }],
  },
  '115-1/classrooms.json': {
    ...SCOPED,
    classroom_count: 1,
    classrooms: [
      { id: 'r1', name: '共同101', course_count: 3, course_ids: ['1', '2'], url: '' },
    ],
  },
  'capacity.json': {
    schema_version: 3,
    classroom_count: 1,
    classrooms: { r1: { name: '共同101', full_name: '共同科館101室', capacity: 60 } },
  },
}

afterEach(() => vi.unstubAllGlobals())

function open(path: string) {
  stubApi(API)
  renderRoute(path)
}

const heading = (name: string) => screen.findByRole('heading', { name, level: 1 })

describe('/teacher/$semester/$teacherId', () => {
  it('列出系所(查不到的代碼照原樣)與代碼,課程依學期分組', async () => {
    open('/teacher/115-1/t1')
    await heading('王小明')
    expect(screen.getByRole('link', { name: '資工系' })).toHaveAttribute(
      'href',
      '/dept/115-1/59',
    )
    expect(screen.getByRole('link', { name: 'ZZ' })).toBeInTheDocument()
    expect(screen.getByText('代碼 t1')).toBeInTheDocument()
    expect(screen.getByText('作業系統')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toContain('王小明'))
    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'credits' } })
    expect(screen.getByLabelText('排序')).toHaveValue('credits')
  })

  it('查無此人時用姓名說明,而不是代碼', async () => {
    stubApi({
      ...API,
      '115-1/teachers.json': {
        ...SCOPED,
        teacher_count: 1,
        teachers: [
          { id: 't9', name: '侯政伯', course_count: 0, department_ids: [], path: '' },
        ],
      },
    })
    renderRoute('/teacher/115-1/t9')
    await heading('查無此教師')
    await screen.findByText(/「侯政伯」這個/)
  })

  it('不存在的學期', async () => {
    open('/teacher/199-9/t1')
    await heading('查無此教師')
  })
})

describe('/dept/$semester/$deptId', () => {
  it('列出學院、班級與課程', async () => {
    open('/dept/115-1/59')
    await heading('資工系')
    expect(screen.getByText('電資學院')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '資工一甲' })).toHaveAttribute(
      'href',
      '/class/115-1/2501',
    )
    expect(screen.getByText('作業系統')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'credits' } })
    expect(screen.getByLabelText('排序')).toHaveValue('credits')
  })

  it('院級共同課程另外說明', async () => {
    open('/dept/115-1/C2')
    await heading('電資學院')
    expect(screen.getByText(/這是院級共同課程/)).toBeInTheDocument()
  })

  it('不屬於任何學院的單位顯示成校級單位', async () => {
    open('/dept/115-1/A0')
    await heading('教務處')
    expect(screen.getByText('校級單位')).toBeInTheDocument()
  })

  it('查無此系所', async () => {
    open('/dept/115-1/XX')
    await heading('查無此系所')
  })

  it('不存在的學期', async () => {
    open('/dept/199-9/59')
    await heading('查無此系所')
  })
})

describe('/program/$semester/$programName', () => {
  it('列出學程裡查得到的課', async () => {
    open(`/program/115-1/${encodeURIComponent('人工智慧學程')}`)
    await heading('人工智慧學程')
    expect(screen.getByText('機器學習')).toBeInTheDocument()
  })

  it('名稱改過的舊連結說明原因', async () => {
    open(`/program/115-1/${encodeURIComponent('舊學程')}`)
    await heading('查無此學程')
    expect(screen.getByText(/名稱改過的話舊連結就會失效/)).toBeInTheDocument()
  })

  it('不存在的學期', async () => {
    open('/program/199-9/x')
    await heading('查無此學程')
  })
})

describe('/classroom/$semester/$classroomId', () => {
  it('列出全名、座位數,並說明索引裡少了幾門', async () => {
    open('/classroom/115-1/r1')
    await heading('共同101')
    expect(await screen.findByText('共同科館101室')).toBeInTheDocument()
    expect(screen.getByText('60 個座位')).toBeInTheDocument()
    expect(screen.getByText(/教室列了 3 門/)).toBeInTheDocument()
    expect(screen.getByText('作業系統')).toBeInTheDocument()
  })

  it('查無此教室', async () => {
    open('/classroom/115-1/r9')
    await heading('查無此教室')
  })

  it('不存在的學期', async () => {
    open('/classroom/199-9/r1')
    await heading('查無此教室')
  })
})
