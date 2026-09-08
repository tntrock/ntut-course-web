import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { DetailShell } from './DetailShell'

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
