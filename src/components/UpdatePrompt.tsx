import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * 有新版本時的提示。
 *
 * **刻意不自動更新。** 自動更新會在背景換掉程式碼並重新載入頁面 ——
 * 使用者可能正排課排到一半,頁面突然重整是很糟的體驗。什麼時候更新由他決定。
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="border-primary bg-primary-muted flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm"
    >
      <p className="flex-1">有新版本可以更新。</p>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="bg-primary text-primary-foreground rounded-lg px-3 py-1 text-xs font-medium"
      >
        立即更新
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="text-muted-foreground hover:bg-accent rounded-lg px-2 py-1 text-xs"
      >
        稍後
      </button>
    </div>
  )
}
