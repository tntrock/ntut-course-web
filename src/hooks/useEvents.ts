import { useSyncExternalStore } from 'react'
import { EVENTS_KEY, loadEvents, saveEvents, type EventStore } from '@/lib/events'

/**
 * 個人事務的單一真相。
 *
 * 結構跟 `useStore` 一樣(`useSyncExternalStore` + `storage` 事件跨分頁同步),
 * 但**刻意是分開的兩個 store**,因為底下是分開的兩個 localStorage key ——
 * 理由寫在 `lib/events.ts` 的開頭。
 *
 * 合併成一個 hook 的話,任何一邊寫入都會讓另一邊重讀,而且遲早有人把事務
 * 塞進 `Store` 裡「順便」存掉,那正是這個設計要避免的事。
 */

let snapshot: EventStore | null = null
const listeners = new Set<() => void>()

function current(): EventStore {
  snapshot ??= loadEvents()
  return snapshot
}

function emit(): void {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  // `key` 為 null 代表整個 localStorage 被清空
  if (event.key !== null && event.key !== EVENTS_KEY) return
  snapshot = loadEvents()
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

export function useEvents(): EventStore {
  return useSyncExternalStore(subscribe, current, current)
}

/**
 * 更新個人事務。回傳是否寫入成功 —— 呼叫端要有機會告訴使用者「存不下」。
 *
 * `updater` 回傳同一個參考時視為沒有變動,不寫入也不通知。
 */
export function updateEvents(updater: (events: EventStore) => EventStore): boolean {
  const before = current()
  const next = updater(before)
  if (next === before) return true

  snapshot = next
  const ok = saveEvents(next)
  emit()
  return ok
}
