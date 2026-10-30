import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, META, SCOPED, fullCourse } from '@/test/fixtures'
import { course, savedCourse, slot } from '@/test/factories'
import { updateStore } from '@/hooks/useStore'
import { updateEvents } from '@/hooks/useEvents'
import { newEvent } from '@/lib/events'
import { defaultStore, loadStore } from '@/lib/storage'

const PERIODS = [
  { code: '1', start: '08:10', end: '09:00' },
  { code: '2', start: '09:10', end: '10:00' },
]

const MATH = {
  id: '1',
  name_zh: '微積分',
  time_slots: [slot(1, '1')],
  department_ids: ['59'],
}
const PHYS = { id: '2', name_zh: '物理', time_slots: [slot(1, '1')] }
const PE = { id: '3', name_zh: '體育', time_slots: [] }

function api(index: unknown) {
  return {
    ...BASE_API,
    'meta.json': { ...META, periods: PERIODS },
    '115-1/index.json': index,
    '115-1/courses/59.json': {
      ...SCOPED,
      department: { id: '59', name: '資工系', college: '電資學院', url: '' },
      course_count: 1,
      courses: [{ ...fullCourse({ id: '1' }), classrooms: ['三教101'] }],
    },
  }
}

function seed() {
  const store = defaultStore()
  store.schedules['115-1'] = {
    courses: [savedCourse(MATH), savedCourse(PHYS), savedCourse(PE)],
  }
  updateStore(() => store)
  updateEvents(() => ({ '115-1': [newEvent('社團', [], null)] }))
}

beforeEach(() => {
  localStorage.clear()
  updateStore(() => defaultStore())
  updateEvents(() => ({}))
})
afterEach(() => vi.unstubAllGlobals())

const page = () => screen.findByRole('heading', { name: '我的課表', level: 1 })

describe('/schedule', () => {
  it('課表是空的時候,指到搜尋頁', async () => {
    stubApi(api({ semester: '115-1', courses: [] }))
    renderRoute('/schedule')
    await page()
    expect(screen.getByText('115-1 的課表還是空的')).toBeInTheDocument()
  })

  it('畫出課表:衝堂警告、未排入時段、統計,並補上教室', async () => {
    seed()
    stubApi(
      api({ semester: '115-1', courses: [course(MATH), course(PHYS), course(PE)] }),
    )
    renderRoute('/schedule')
    await page()

    expect(screen.getByText(/1 處衝堂，涉及 2 項/)).toBeInTheDocument()
    expect(screen.getByText('未排入時段')).toBeInTheDocument()
    expect(screen.getAllByText('社團').length).toBeGreaterThan(0)
    expect(screen.getByText('全部 3 門')).toBeInTheDocument()
    // 搜尋結果加入的課沒有教室,回頭從系所檔補起來
    await waitFor(() =>
      expect(
        loadStore().schedules['115-1']?.courses.find((c) => c.id === '1')?.snapshot
          .classrooms,
      ).toEqual(['三教101']),
    )
  })

  it('課程有異動時列出來', async () => {
    seed()
    stubApi(api({ semester: '115-1', courses: [course({ ...MATH, credits: 4 })] }))
    renderRoute('/schedule')
    await page()
    expect(await screen.findByText(/門課有異動/)).toBeInTheDocument()
    expect(screen.getAllByText(/此課已停開/).length).toBeGreaterThan(0)
  })

  it('連不上資料來源時照樣畫出課表,只停用異動偵測', async () => {
    seed()
    stubApi({ ...api({}), '115-1/index.json': { status: 500 } })
    renderRoute('/schedule')
    await page()
    expect(await screen.findByText(/異動偵測暫時停用/)).toBeInTheDocument()
  })

  it('週末欄可以打開,學期可以切換', async () => {
    seed()
    stubApi(
      api({ semester: '115-1', courses: [course(MATH), course(PHYS), course(PE)] }),
    )
    renderRoute('/schedule')
    await page()

    fireEvent.click(screen.getByRole('checkbox', { name: '週末' }))
    expect(await screen.findAllByText('週六')).not.toHaveLength(0)
    expect(loadStore().settings.showWeekend).toBe(true)

    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '115-1' } })
  })
})
