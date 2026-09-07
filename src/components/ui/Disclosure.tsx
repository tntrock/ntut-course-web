/**
 * `<details>` 的展開箭頭。
 *
 * 不用瀏覽器原生的 ▶：每家長得不一樣，顏色與動畫都控不了，而且全站只有一處
 * 換掉的話反而更像沒做完。也不用 `›` 那類文字字符 —— 文字字符帶著字型的側邊
 * 間距，實測會凸出容器右緣 3.33px，在設了 `overflow-y` 的側欄裡就為了那 3px
 * 長出一條左右橫移的捲軸。SVG 的邊界是精確的。
 *
 * 展開時轉 90°，所以 `<details>` 上要有 `group`。
 */
export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 transition-transform group-open:rotate-90 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  )
}

/**
 * `<summary>` 的共用樣式：拿掉原生標記、可點、不會被拖曳選取。
 *
 * `list-none` 與 `marker:content-none` 要**兩個都寫** —— WebKit 認前者，
 * 其他瀏覽器認後者。
 */
export const SUMMARY_CLASS =
  'flex cursor-pointer list-none items-center gap-1.5 select-none marker:content-none'
