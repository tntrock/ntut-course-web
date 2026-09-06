import { useSyncExternalStore } from 'react'

/**
 * 課程卡片網格的欄數。
 *
 * 這個模組同時擁有**兩份**定義:給 JS 的數字,和給 Tailwind 的 class 字串。
 * 不得已 —— 虛擬捲動要在 JS 裡知道欄數(每一欄是一個 lane),而 Tailwind 的
 * JIT 只認得字面的 class,推導不出來。
 *
 * 能做的是讓兩份**擺在一起**,並用 `useColumns.test.ts` 釘住它們一致。
 */

/** Tailwind 預設斷點的像素值。 */
export const TAILWIND_SCREENS = { sm: 640, xl: 1280 } as const

/** 視窗寬度 → 欄數,由大到小。 */
export const BREAKPOINTS = [
  { min: TAILWIND_SCREENS.xl, columns: 3 },
  { min: TAILWIND_SCREENS.sm, columns: 2 },
  { min: 0, columns: 1 },
] as const

/** 非虛擬清單(瀏覽頁)的網格 class。與 `BREAKPOINTS` 同義,測試會比對。 */
export const COURSE_GRID_CLASS = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'

function columnsFor(width: number): number {
  return BREAKPOINTS.find((b) => width >= b.min)?.columns ?? 1
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/**
 * 目前該排幾欄。
 *
 * 用 `useSyncExternalStore` 而不是 `useState` + effect:視窗寬度是外部狀態,
 * 這個 hook 就是為它設計的,而且不會有「先用錯的欄數渲染一次」的閃動。
 */
export function useColumns(): number {
  return useSyncExternalStore(
    subscribe,
    () => columnsFor(window.innerWidth),
    // 伺服器端沒有 window。本站是純前端渲染,這條只是為了型別完整
    () => 1,
  )
}
