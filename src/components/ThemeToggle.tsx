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
      className="hover:bg-accent focus-visible:ring-ring text-muted-foreground hover:text-foreground grid size-9 shrink-0 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}

/**
 * 線條圖示,不用 emoji。
 *
 * emoji 是彩色點陣圖,跟旁邊一排單色文字連結擺在一起會像沒做完 —— 而且
 * 每個平台長得都不一樣(Windows 的 ☀️ 跟 macOS 的差很多),對不齊也控不了顏色。
 * 用 `currentColor` 的 SVG 才會跟著主題與 hover 一起變。
 */
function ThemeIcon({ theme }: { theme: (typeof THEMES)[number] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    )
  }

  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }

  // 跟隨系統
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
