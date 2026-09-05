import { useSyncExternalStore } from 'react'
import {
  loadStore,
  saveStore,
  STORAGE_KEY,
  type SaveResult,
  type Store,
} from '@/lib/storage'

/**
 * 個人資料的單一真相。
 *
 * 用 `useSyncExternalStore` 而不是 React state 或 context 的三個理由:
 *
 * 1. `localStorage` 本來就是外部狀態,這個 hook 就是為它設計的
 * 2. **跨分頁同步** —— 在另一個分頁加了課,這個分頁要跟著變。`storage` 事件
 *    只在其他分頁觸發,正好是我們要的
 * 3. 不必把 provider 包在整棵樹上,任何元件要用就直接用
 */

let snapshot: Store | null = null
const listeners = new Set<() => void>()

function current(): Store {
  // 第一次真的被用到才讀 —— 模組載入時就讀會拖慢首屏
  snapshot ??= loadStore()
  return snapshot
}

function emit(): void {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  // `key` 為 null 代表整個 localStorage 被清空
  if (event.key !== null && event.key !== STORAGE_KEY) return
  snapshot = loadStore()
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

export function useStore(): Store {
  return useSyncExternalStore(subscribe, current, current)
}

/**
 * 更新個人資料。回傳寫入結果 —— 呼叫端要有機會告訴使用者「存不下」。
 *
 * `updater` 回傳同一個參考時視為沒有變動,不寫入也不通知 ——
 * 重複加入同一門課就是這種情況。
 */
export function updateStore(updater: (store: Store) => Store): SaveResult {
  const before = current()
  const next = updater(before)
  if (next === before) return { ok: true }

  snapshot = next
  const result = saveStore(next)
  emit()
  return result
}
