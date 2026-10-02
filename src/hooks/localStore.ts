import { useSyncExternalStore } from 'react'

/**
 * 把一個 localStorage key 接成 React 看得到的 store。
 *
 * 用 `useSyncExternalStore` 而不是 React state 或 context 的三個理由:
 *
 * 1. `localStorage` 本來就是外部狀態,這個 hook 就是為它設計的
 * 2. **跨分頁同步** —— 在另一個分頁加了課,這個分頁要跟著變。`storage` 事件
 *    只在其他分頁觸發,正好是我們要的
 * 3. 不必把 provider 包在整棵樹上,任何元件要用就直接用
 *
 * 課程(`useStore`)與個人事務(`useEvents`)各建一個 —— 底下是分開的兩個
 * key,理由寫在 `lib/events.ts` 的開頭。
 */
export function createLocalStore<T, R>(
  key: string,
  load: () => T,
  save: (value: T) => R,
  /** `updater` 沒有改動時回傳的值 —— 沒寫入就沒有失敗可言。 */
  unchanged: R,
) {
  let snapshot: T | null = null
  const listeners = new Set<() => void>()

  // 第一次真的被用到才讀 —— 模組載入時就讀會拖慢首屏
  const current = (): T => (snapshot ??= load())

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const onStorage = (event: StorageEvent) => {
    // `key` 為 null 代表整個 localStorage 被清空
    if (event.key !== null && event.key !== key) return
    snapshot = load()
    emit()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    if (listeners.size === 1) window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) window.removeEventListener('storage', onStorage)
    }
  }

  return {
    use: (): T => useSyncExternalStore(subscribe, current, current),

    /**
     * 回傳寫入結果 —— 呼叫端要有機會告訴使用者「存不下」。
     *
     * `updater` 回傳同一個參考時視為沒有變動,不寫入也不通知 ——
     * 重複加入同一門課就是這種情況。
     */
    update(updater: (value: T) => T): R {
      const before = current()
      const next = updater(before)
      if (next === before) return unchanged

      snapshot = next
      const result = save(next)
      emit()
      return result
    },
  }
}
