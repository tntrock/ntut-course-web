import { createLocalStore } from './localStore'
import { EVENTS_KEY, loadEvents, saveEvents } from '@/lib/events'

/**
 * 個人事務的單一真相。
 *
 * **刻意跟 `useStore` 分開。** 合併的話任何一邊寫入都會讓另一邊重讀,而且遲早
 * 有人把事務塞進 `Store` 裡「順便」存掉 —— 那正是這個設計要避免的事。
 */
const store = createLocalStore(EVENTS_KEY, loadEvents, saveEvents, true)

export const useEvents = store.use
export const updateEvents = store.update
