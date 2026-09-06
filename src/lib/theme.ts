import type { Store } from './storage'

export type Theme = Store['settings']['theme']

export const THEMES = ['system', 'light', 'dark'] as const satisfies readonly Theme[]

export const THEME_LABELS: Record<Theme, string> = {
  system: '跟隨系統',
  light: '淺色',
  dark: '深色',
}

/** 實際要套用的外觀。`system` 之外的選擇一律壓過系統設定。 */
export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/**
 * 把外觀套到 `<html>`。
 *
 * `dark` class 與 `index.html` 首屏腳本用的是同一個 —— 那支腳本在第一次繪製前
 * 就跑,避免深色模式閃白;這裡負責之後的切換。
 *
 * 同時設 `color-scheme`:只換 class 的話,**原生捲軸與 `<select>` 的下拉**
 * 在深色底下仍然是白的。
 */
export function applyTheme(
  root: HTMLElement,
  theme: Theme,
  prefersDark: boolean,
): void {
  const resolved = resolveTheme(theme, prefersDark)
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
