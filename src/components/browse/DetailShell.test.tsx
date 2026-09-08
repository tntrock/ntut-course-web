import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { DetailNotFound, DetailShell } from './DetailShell'

/**
 * 實測 115-1 有 14 位教師的姓名含造字（見 `lib/pua.ts`），資料層已經換成〇。
 * 但「林〇」單獨出現時看起來仍然像資料壞了 —— 要說一句這個〇是什麼。
 */
function renderShell(title: string) {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <DetailShell kind="教師" title={title} browseTab="teacher" semester="115-1">
        <p>課程列表</p>
      </DetailShell>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('DetailShell', () => {
  it('姓名有〇時說明那是學校的造字', async () => {
    renderShell('林〇')
    expect(await waitFor(() => screen.getByText('林〇'))).toBeInTheDocument()
    expect(screen.getByText(/造字/)).toBeInTheDocument()
  })

  it('一般姓名不要多出一段說明', async () => {
    renderShell('胡石政')
    expect(await waitFor(() => screen.getByText('胡石政'))).toBeInTheDocument()
    expect(screen.queryByText(/造字/)).toBeNull()
  })
})

/**
 * 查不到的畫面是**給人看的**:「沒有 24622 這位教師」對使用者沒有意義,
 * 他要找的是「侯政伯」。查得到姓名就顯示姓名,查不到才退回代碼 ——
 * 而且要講明那是代碼,不然看起來像亂碼。
 */
function renderMissing(props: Parameters<typeof DetailNotFound>[0]) {
  const root = createRootRoute()
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <DetailNotFound {...props} />,
  })
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('DetailNotFound', () => {
  it('查得到姓名就顯示姓名', async () => {
    renderMissing({ kind: '教師', id: '24622', name: '侯政伯', semester: '115-1' })
    expect(await waitFor(() => screen.getByText(/侯政伯/))).toBeInTheDocument()
    expect(screen.queryByText(/24622/)).toBeNull()
  })

  it('查不到姓名時要講明那是代碼', async () => {
    renderMissing({ kind: '教師', id: '24622', semester: '115-1' })
    expect(await waitFor(() => screen.getByText(/代碼 24622/))).toBeInTheDocument()
  })

  it('沒有站內歷史時退回「回瀏覽」,不要按了沒反應', async () => {
    renderMissing({
      kind: '教師',
      id: '24622',
      semester: '115-1',
      browseTab: 'teacher',
    })
    expect(await waitFor(() => screen.getByText(/回瀏覽/))).toBeInTheDocument()
  })
})
