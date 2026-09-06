import { describe, expect, it } from 'vitest'
import { applyTheme, resolveTheme, THEME_LABELS, THEMES } from './theme'

describe('resolveTheme', () => {
  it('明確選了淺色或深色就照選的走,不管系統設定', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('跟隨系統時由系統偏好決定', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  it('深色時掛上 dark class —— index.html 的首屏腳本用的是同一個 class', () => {
    const root = document.createElement('html')

    applyTheme(root, 'dark', false)

    expect(root.classList.contains('dark')).toBe(true)
  })

  it('淺色時把 class 拿掉', () => {
    const root = document.createElement('html')
    root.classList.add('dark')

    applyTheme(root, 'light', true)

    expect(root.classList.contains('dark')).toBe(false)
  })

  it('跟隨系統時依系統偏好切換', () => {
    const root = document.createElement('html')

    applyTheme(root, 'system', true)
    expect(root.classList.contains('dark')).toBe(true)

    applyTheme(root, 'system', false)
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('同時設定 color-scheme —— 捲軸與表單元件才會跟著變', () => {
    // 只換 class 的話,原生捲軸與 <select> 的下拉在深色底下仍是白的
    const root = document.createElement('html')

    applyTheme(root, 'dark', false)

    expect(root.style.colorScheme).toBe('dark')
  })
})

describe('THEMES', () => {
  it('三個選項都有中文標籤,不會漏掉一個變成空按鈕', () => {
    for (const theme of THEMES) {
      expect(THEME_LABELS[theme]).toBeTruthy()
    }
  })
})
