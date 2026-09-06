import { useEffect } from 'react'
import { updateStore, useStore } from '@/hooks/useStore'
import { applyTheme, THEME_LABELS, THEMES } from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * 外觀切換。
 *
 * 設定存在 store 裡,`index.html` 的首屏腳本會先讀它一次避免閃白;
 * 這個元件負責執行期的套用與切換。
 */
export function ThemeToggle() {
  const theme = useStore().settings.theme

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const root = document.documentElement

    const sync = () => {
      applyTheme(root, theme, media.matches)
    }
    sync()

    // 跟隨系統時,使用者在作業系統切換外觀要即時反應,不必重新整理
    if (theme !== 'system') return
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  const cycle = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system'
    updateStore((s) => ({ ...s, settings: { ...s.settings, theme: next } }))
  }

  return (
    <button
      type="button"
      onClick={cycle}
      // 循環式按鈕要講清楚現在是什麼、按下去會變什麼
      aria-label={`外觀：${THEME_LABELS[theme]}，點擊切換`}
      title={`外觀：${THEME_LABELS[theme]}`}
      className="hover:bg-accent focus-visible:ring-ring grid size-9 shrink-0 place-items-center rounded-lg text-base focus-visible:ring-2 focus-visible:outline-none"
    >
      <span aria-hidden>
        {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '💻'}
      </span>
    </button>
  )
}
