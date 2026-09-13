import '@testing-library/jest-dom/vitest'

/**
 * jsdom 沒有實作 `matchMedia`。
 *
 * 主題(跟隨系統的深淺色)與版面斷點都會呼叫它 —— 缺了它,任何會渲染到
 * `ThemeToggle` 或根版面的測試都會炸在 `window.matchMedia is not a function`,
 * 而錯誤訊息完全看不出跟主題有關。
 *
 * 一律回報「不符合」:測試環境沒有系統偏好可言,固定成淺色才不會隨機。
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
