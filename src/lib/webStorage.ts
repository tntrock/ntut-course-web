/**
 * `localStorage` 的存取包裝。
 *
 * **每一次存取都可能丟例外** —— 無痕視窗、瀏覽器停用網站資料、企業政策都會。
 * 那時整個站要照常運作,只是存不下東西,所以這裡一律吞掉例外並回報結果,
 * 讓呼叫端自己決定要不要告訴使用者。
 *
 * 課程(`storage.ts`)與個人事務(`events.ts`)共用這三支。
 */

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 存不了也刪不了,那就讓它留著 —— 總比丟例外好
  }
}
