/**
 * `virtual:pwa-register/react` 的替身。
 *
 * 那是 `vite-plugin-pwa` 在 build 時才產生的虛擬模組,vitest 解析不到它
 * (會把它當成檔案路徑),整個路由樹就載不起來 —— 根路由用了 `UpdatePrompt`。
 *
 * 回傳固定的「沒有新版本」:service worker 的更新流程不是這一層測試的對象,
 * 而且 jsdom 裡根本沒有 service worker。
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
