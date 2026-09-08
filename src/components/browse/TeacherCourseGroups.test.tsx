import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { TeacherCourseGroups, type SemesterCourses } from './TeacherCourseGroups'
import { course } from '@/test/factories'
import type { Meta } from '@/types/api'

const meta = {
  latest: '115-1',
  semesters: [{ path: '115-1', generated_at: 'x' }],
  periods: [{ code: '1', start: '08:10', end: '09:00' }],
} as unknown as Meta

function renderGroups(groups: SemesterCourses[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['meta'], { data: meta, fromCache: false })

  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <TeacherCourseGroups groups={groups} periods={meta.periods} />,
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('TeacherCourseGroups', () => {
  const many: SemesterCourses[] = [
    { semester: '115-1', courses: [course({ id: '1', name_zh: '流體力學試驗' })] },
    { semester: '114-2', courses: [course({ id: '2', name_zh: '水文系統監測' })] },
  ]

  it('多學期時每一段標出自己的學期', async () => {
    renderGroups(many)
    await waitFor(() => screen.getByText('流體力學試驗'))
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(heads).toEqual(['115-11 門', '114-21 門'])
  })

  it('多學期時標題寫幾個學期、幾門課', async () => {
    renderGroups(many)
    const line = await waitFor(() => screen.getByText(/門課/).closest('p'))
    expect(line?.textContent).toContain('2 個學期')
    expect(line?.textContent).toContain('2 門課')
  })

  it('只有一個學期時照原本的樣子 —— 標題寫學期,不重複一個段落標題', async () => {
    // 從瀏覽頁、課程頁進來的人看到的應該跟以前一模一樣
    renderGroups([many[0]!])
    const line = await waitFor(() => screen.getByText(/門課/).closest('p'))
    expect(line?.textContent).toContain('115-1')
    expect(line?.textContent).not.toContain('個學期')
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })

  it('六段共用一個排序框,不是每段一個', async () => {
    renderGroups(many)
    await waitFor(() => screen.getByText('流體力學試驗'))
    expect(screen.getAllByLabelText('排序')).toHaveLength(1)
  })
})
