import { useSyncExternalStore } from 'react'

/** 斷點與欄數。與 Tailwind 的 `sm` / `xl` 對齊。 */
const BREAKPOINTS = [
  { min: 1280, columns: 3 },
  { min: 640, columns: 2 },
  { min: 0, columns: 1 },
] as const

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
 * 虛擬捲動要在 JS 裡知道欄數(每一欄是一個 lane),沒辦法只靠 CSS grid ——
 * 所以斷點在這裡與 Tailwind 各寫一次,改的時候兩邊要一起改。
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
