import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">找不到這個頁面</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        網址可能打錯了,或這個頁面已經移除。
      </p>
    </div>
  )
}
