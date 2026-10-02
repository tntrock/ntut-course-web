import { createLocalStore } from './localStore'
import { loadStore, saveStore, STORAGE_KEY, type SaveResult } from '@/lib/storage'

/** 個人資料(課表、收藏、設定)的單一真相。 */
const store = createLocalStore(STORAGE_KEY, loadStore, saveStore, {
  ok: true,
} as SaveResult)

export const useStore = store.use
export const updateStore = store.update
