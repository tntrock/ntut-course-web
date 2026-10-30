import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, META } from '@/test/fixtures'

const SCOPED = { schema_version: 3, year: 115, sem: 1 }

const API = {
  ...BASE_API,
  '115-1/departments.json': {
    semester: '115-1',
    departments: [
      {
        id: '59',
        name: '資工系',
        college: '電資學院',
        url: '',
        class_groups: [{ id: '2501', name: '資工一甲' }],
        course_count: 12,
        path: '115-1/courses/59.json',
      },
      {
        id: 'C2',
        name: '電資學院',
        college: '電資學院',
        url: '',
        class_groups: [],
        course_count: 3,
        path: '115-1/courses/C2.json',
      },
    ],
    colleges: [{ name: '電資學院', department_ids: ['59', 'C2'] }],
  },
  '115-1/teachers.json': {
    ...SCOPED,
    teacher_count: 2,
    teachers: [
      { id: 't1', name: '王小明', course_count: 2, department_ids: ['59'], path: '' },
      { id: 't2', name: '林大華', course_count: 1, department_ids: ['X'], path: '' },
    ],
  },
  '115-1/programs.json': {
    ...SCOPED,
    program_count: 1,
    programs: [{ name: '人工智慧學程', course_count: 4, course_ids: [] }],
  },
  '115-1/classrooms.json': {
    ...SCOPED,
    classroom_count: 1,
    classrooms: [
      { id: 'r1', name: '共同101', course_count: 5, course_ids: [], url: '' },
    ],
  },
}

afterEach(() => vi.unstubAllGlobals())

function open(path = '/browse') {
  const api = stubApi(API)
  renderRoute(path)
  return api
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('/browse', () => {
  it('系所分頁:依學院分組,院級單位另外標示,班級可展開', async () => {
    open()
    expect(await screen.findByRole('link', { name: '資工系' })).toHaveAttribute(
      'href',
      '/dept/115-1/59',
    )
    expect(screen.getByText('院級共同課程')).toBeInTheDocument()
    expect(screen.getByText('12 門')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '資工一甲' })).toHaveAttribute(
      'href',
      '/class/115-1/2501',
    )
  })

  it('只載入目前分頁要用的清單', async () => {
    const api = open()
    await screen.findByRole('link', { name: '資工系' })
    expect(api.calls.some((u) => u.includes('teachers.json'))).toBe(false)
  })

  it('關鍵字過濾,找不到時說清楚', async () => {
    open('/browse?q=不存在')
    expect(await screen.findByText('沒有符合的系所。')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('搜尋系所'), { target: { value: '資工' } })
    expect(await screen.findByRole('link', { name: '資工系' })).toBeInTheDocument()
  })

  it('教師分頁:標出所屬系所,查不到的系所代碼照原樣顯示', async () => {
    open()
    await screen.findByRole('link', { name: '資工系' })
    fireEvent.click(tab('教師'))

    const link = await screen.findByRole('link', { name: /王小明/ })
    expect(link).toHaveAttribute('href', '/teacher/115-1/t1')
    expect(link.textContent).toContain('資工系')
    expect(screen.getByRole('link', { name: /林大華/ }).textContent).toContain('X')
    expect(tab('教師')).toHaveAttribute('aria-selected', 'true')
  })

  it('學程與教室分頁', async () => {
    open('/browse?tab=program')
    expect(await screen.findByRole('link', { name: /人工智慧學程/ })).toHaveAttribute(
      'href',
      `/program/115-1/${encodeURIComponent('人工智慧學程')}`,
    )

    fireEvent.click(tab('教室'))
    expect(await screen.findByRole('link', { name: /共同101/ })).toHaveAttribute(
      'href',
      '/classroom/115-1/r1',
    )
  })

  it('各分頁找不到時都有說明', async () => {
    for (const [name, what] of [
      ['teacher', '教師'],
      ['program', '學程'],
      ['classroom', '教室'],
    ]) {
      open(`/browse?tab=${name}&q=zzz`)
      expect(await screen.findByText(`沒有符合的${what}。`)).toBeInTheDocument()
      document.body.innerHTML = ''
    }
  })

  /**
   * 回歸測試:換分頁會清掉 `q`,但 debounce 裡還是舊字,effect 會把它寫回去 ——
   * 新分頁一打開就被舊關鍵字過濾成空的。
   */
  it('換分頁會清掉關鍵字,而且不會被搜尋框寫回來', async () => {
    open('/browse?q=資工')
    await screen.findByRole('link', { name: '資工系' })

    fireEvent.click(tab('教師'))
    expect(await screen.findByRole('link', { name: /王小明/ })).toBeInTheDocument()
    expect(screen.getByLabelText('搜尋教師')).toHaveValue('')
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText('沒有符合的教師。')).toBeNull()
  })

  it('換學期與忽略不合法的網址參數', async () => {
    open('/browse?tab=bogus&sem=')
    await screen.findByRole('link', { name: '資工系' })
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: META.latest } })
    expect(tab('系所')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('/browse 載入失敗', () => {
  it('沒有教室清單也不會整頁掛掉在別的分頁', async () => {
    open('/browse?tab=classroom')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /共同101/ })).toBeVisible(),
    )
  })
})
