import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { parseSearch, stringifySearch } from './lib/searchParams'
import { routeTree } from './routeTree.gen'
import './index.css'

// 資料的新鮮度由 api.ts 的 generated_at 版本號決定(見 plan §2.2),
// 所以 Query 這層不需要再自己過期 —— 設成永不 stale,避免重複請求。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // 陣列參數用重複 key,網址才讀得懂;預設的 JSON 編碼會變成一團 %5B%22
  parseSearch,
  stringifySearch,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('找不到 #root 掛載點')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
