import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { EventCard } from './EventCard'
import type { ChangeEvent } from '@/types/api'

/**
 * `changes.json` 的事件型別是**開放**的 —— crawler 的相容性承諾說「新增欄位不升
 * `schema_version`」,新增一個 `type` 也算新增。實際發生過:`teacher_added` 出現
 * 之後整頁掛掉,錯誤訊息還顯示成「連不上資料來源」。
 *
 * crawler README 也明講:「使用端請把 `type` 以外的欄位一律當成選填,缺了就降級
 * 顯示,不要假設一定存在。」
 */
function renderCard(event: ChangeEvent) {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <EventCard
        event={event}
        names={{ department: () => '資工系', classGroup: () => '資工四' }}
        periods={[{ code: '1', start: '08:10', end: '09:00' }]}
      />
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

async function findText(text: string) {
  return waitFor(() => screen.getByText(text))
}

describe('EventCard', () => {
  it('顯示教師新增事件', async () => {
    renderCard({
      at: '2026-09-07T03:34:15Z',
      semester: '115-1',
      type: 'teacher_added',
      id: '24723',
      name: '溫子慶',
      course_count: 1,
      department_ids: ['39'],
    } as ChangeEvent)

    expect(await findText('溫子慶')).toBeInTheDocument()
    expect(await findText('新增教師')).toBeInTheDocument()
  })

  it('教師事件沒有 teachers 欄位也不會爆掉', () => {
    // 這正是掛掉的原因:程式碼掉進課程分支後讀 event.teachers.length
    expect(() =>
      renderCard({
        at: '2026-09-07T03:34:15Z',
        semester: '115-1',
        type: 'teacher_removed',
        id: '12095',
        name: '白敦文',
        course_count: 1,
        department_ids: ['59'],
      } as ChangeEvent),
    ).not.toThrow()
  })

  it('系所與班級都要列出來,而且分得出哪個是哪個', async () => {
    /*
     * 實測:這次停開的「技職所」課程,其實是「職技職所」班。兩個名字只差一個字,
     * 只列系所會被讀成整個技職所停開;兩個都列但不標籤,又會像把同一個東西
     * 寫了兩遍。所以各自標上「系所」「班級」。
     */
    renderCard({
      at: '2026-09-08T05:36:00Z',
      semester: '115-1',
      type: 'course_removed',
      id: '367444',
      name: '論文',
      teachers: [],
      department_ids: ['39'],
      class_ids: ['3765'],
    } as ChangeEvent)

    const line = await waitFor(() => screen.getByText(/資工系/).closest('p'))
    expect(line?.textContent).toContain('系所 資工系')
    expect(line?.textContent).toContain('班級 資工四')
  })

  it('沒有班級資料時不要留一個空的「班級」標籤', async () => {
    renderCard({
      at: '2026-09-08T05:36:00Z',
      semester: '115-1',
      type: 'course_removed',
      id: '367444',
      name: '論文',
      teachers: [],
      department_ids: ['39'],
    } as ChangeEvent)

    const line = await waitFor(() => screen.getByText(/資工系/).closest('p'))
    expect(line?.textContent).not.toContain('班級')
  })

  it('沒看過的型別要降級顯示,不能讓整頁掛掉', async () => {
    // 第八種型別遲早會出現。那時應該少顯示一點,不是整頁白掉
    expect(() =>
      renderCard({
        at: '2026-09-07T03:34:15Z',
        semester: '115-1',
        type: 'classroom_changed',
        id: 'x',
        name: '未來的事件',
      } as unknown as ChangeEvent),
    ).not.toThrow()
    expect(await findText('未來的事件')).toBeInTheDocument()
  })

  it('課程事件缺 teachers 時顯示「未定」而不是爆掉', async () => {
    // 事件是 append-only,舊事件可能缺後來才加的欄位
    expect(() =>
      renderCard({
        at: '2026-09-04T02:39:21Z',
        semester: '115-1',
        type: 'course_added',
        id: '367444',
        name: '論文',
      } as unknown as ChangeEvent),
    ).not.toThrow()
    expect(await findText('論文')).toBeInTheDocument()
  })
})
