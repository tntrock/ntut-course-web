import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { AppHeader } from '@/components/AppHeader'
import { OfflineNotice } from '@/components/OfflineNotice'
import { RecoveryNotice } from '@/components/RecoveryNotice'
import { SchemaWarning } from '@/components/SchemaWarning'
import { ApiError } from '@/lib/api'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // meta 是所有頁面的前置,在路由層先備妥,元件裡就不必處理載入狀態
  loader: ({ context }) => context.queryClient.ensureQueryData(metaQueryOptions()),
  component: RootLayout,
  pendingComponent: Loading,
  errorComponent: LoadFailed,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const { data: meta, fromCache } = useMeta()

  return (
    <div className="flex min-h-dvh flex-col">
      <SchemaWarning version={meta.schema_version} />
      {fromCache && <OfflineNotice generatedAt={meta.generated_at} />}
      {/* 個人資料損毀過就要講,不能讓課表默默變空 */}
      <RecoveryNotice />

      <AppHeader />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* 免責聲明每頁都要看得見,不能只放在關於頁 */}
      <footer className="text-muted-foreground border-t px-4 py-6 text-xs">
        <p className="mx-auto max-w-3xl">{meta.disclaimer}</p>
      </footer>
    </div>
  )
}

function Loading() {
  return (
    <div className="text-muted-foreground px-4 py-24 text-center text-sm">載入中…</div>
  )
}

function LoadFailed({ error }: { error: Error }) {
  const isApiError = error instanceof ApiError

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">取不到課程資料</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {isApiError
          ? `資料來源回應 HTTP ${error.status}。這是資料來源的問題,不是你的網路。`
          : '連不上資料來源。請確認網路後再重新整理。'}
      </p>
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
