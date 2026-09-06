/**
 * Google Analytics 的 SPA 接線。
 *
 * gtag 的預設片段只在**檔案載入時**送一次 `page_view`。本站是單頁應用,換路由
 * 不會重新載入文件 —— 只放那段片段的話,除了進站的第一頁以外全部不會被記到。
 */

export type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

/**
 * 建立送 `page_view` 的函式。
 *
 * 用工廠而不是模組層變數,是為了讓測試各自拿到乾淨的狀態,不必在正式程式碼裡
 * 開一個只有測試會用的 reset。
 *
 * `send` 收 `window.gtag`。擋廣告的擴充套件會讓它根本沒定義 ——
 * **統計掛掉不該讓導頁跟著爆掉**,所以拿不到就安靜跳過。
 */
export function createPageViewTracker(send: GtagFn | undefined) {
  let lastHref: string | null = null

  return (href: string): void => {
    // 路由的 onResolved 在初次載入也會觸發,擋掉重複的才不會把首頁算成兩次
    if (href === lastHref) return
    lastHref = href
    if (!send) return

    let path = href
    try {
      const url = new URL(href)
      // 帶上 query string —— 搜尋條件全部在網址上,`?q=微積分` 和 `?q=物理`
      // 是兩個不同的查詢,合併計算就看不出大家在找什麼
      path = url.pathname + url.search
    } catch {
      // 網址解析不了就原樣送,總比不送好
    }

    send('event', 'page_view', { page_location: href, page_path: path })
  }
}
