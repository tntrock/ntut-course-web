import { render, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

import { createFakeFetch, installFakeCaches, type FakeFetch } from './fake-cache'
import { routeTree } from '@/routeTree.gen'
import { parseSearch, stringifySearch } from '@/lib/searchParams'

/**
 * 測試用的 QueryClient。
 *
 * `retry: false` 是必要的 —— 預設會重試,測「請求失敗時的畫面」會白等好幾秒,
 * 而且真正的失敗原因會被重試蓋掉。
 */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
}

/**
 * 把一個元件放進「有 router 與 QueryClient」的環境裡。
 *
 * 元件測試本來各自複製一份這段(實測四個檔案各一份),抽出來之後改 router 的
 * 用法只要改一個地方。要連 loader 一起跑請用 `renderRoute()`。
 */
export function renderInRouter(
  ui: ReactNode,
  { path = '/', client = testQueryClient() } = {},
): RenderResult {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: client },
  })

  return render(
    <QueryClientProvider client={client}>
      {/* 這棵樹是測試臨時組的,型別對不上正式那棵 */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

/**
 * 攔下所有對資料來源的請求。
 *
 * 用 `onMissing: 'throw'` —— 整條路由跑起來會抓十幾個檔案,少準備一個的話
 * 畫面只會顯示「取不到課程資料」,得自己猜是哪一個。丟例外才會直接說出來。
 */
export function stubApi(fixture: Record<string, unknown>): FakeFetch {
  installFakeCaches()
  const fake = createFakeFetch(fixture, { onMissing: 'throw' })
  vi.stubGlobal('fetch', fake)
  // 回傳它,測試才能斷言「有沒有發出某個請求」—— 那是 loader 排程的重點
  return fake
}

/**
 * 渲染**真正的**檔案式路由,連它的 loader 一起跑。
 *
 * 這是元件測試補不到的那一層:`validateSearch`、`loaderDeps`、loader 的請求
 * 排程、`notFound()`,以及 `head()` 產生的標題,全都只有走完整條路由才會經過。
 */
export function renderRoute(
  path: string,
  { client = testQueryClient() } = {},
): RenderResult {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: client },
    parseSearch,
    stringifySearch,
  })

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}
