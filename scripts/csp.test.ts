import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** `index.html` 裡沒有 `src` 的 `<script>`,也就是 CSP 要逐一雜湊的那些。 */
function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1] ?? '',
  )
}

function sha256(text: string): string {
  return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`
}

const html = readFileSync('index.html', 'utf8')
const headers = readFileSync('public/_headers', 'utf8')

describe('CSP 的 inline script 雜湊', () => {
  /**
   * **這個測試是為了讓漂移變大聲。**
   *
   * CSP 用 sha256 而不是 nonce:改寫後的 HTML 會被快取在邊緣(見 worker/index.ts),
   * 每個人拿到同一份,所以 nonce 一旦被快取就等於沒有 nonce。雜湊是靜態的、
   * 可以快取的,但代價是**改了那兩段 inline script 就會對不上**。
   *
   * 對不上的後果是靜默的:主題偵測被擋 → 深色模式閃白;GA 設定被擋 → 統計停掉。
   * 兩個都不會讓畫面壞掉,所以沒有人會發現。
   */
  it('每一段 inline script 的雜湊都在 CSP 裡', () => {
    const scripts = inlineScripts(html)
    expect(scripts.length).toBeGreaterThan(0)

    for (const script of scripts) {
      const hash = sha256(script)
      expect(
        headers.includes(hash),
        `index.html 有一段 inline script 的雜湊不在 public/_headers 的 CSP 裡。\n` +
          `請把 '${hash}' 加進 script-src（或更新既有的那個）。\n` +
          `開頭：${script.trim().slice(0, 80)}…`,
      ).toBe(true)
    }
  })

  /**
   * Vite 不會動 `index.html` 的 inline script(實測 source 與 dist 的位元組與
   * 雜湊都相同),所以拿原始檔算就夠了。這條是在盯那個前提有沒有變。
   */
  it('CSP 裡的雜湊沒有多餘的 —— 刪掉 script 卻忘了刪雜湊也算漂移', () => {
    const listed = [...headers.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1])
    const actual = inlineScripts(html).map(sha256)
    expect([...listed].sort()).toEqual([...actual].sort())
  })
})

describe('CSP 的基本形狀', () => {
  const csp = headers
    .split('\n')
    .find((line) => line.trim().startsWith('Content-Security-Policy:'))

  it('是強制模式,不是 report-only', () => {
    expect(csp, 'public/_headers 裡找不到強制模式的 CSP').toBeDefined()
    expect(headers).not.toContain('Content-Security-Policy-Report-Only')
  })

  it.each([
    ["object-src 'none'", '沒有任何 <object>/<embed>,關掉是白拿的'],
    ["base-uri 'self'", '擋掉用 <base> 把相對路徑導去別的網域'],
    ["frame-ancestors 'none'", '不給別人嵌成 iframe（X-Frame-Options 的現代版）'],
  ])('含 %s', (directive) => {
    expect(csp).toContain(directive)
  })

  /**
   * 「存成圖片」會用 fetch 把 Google Fonts 抓下來內嵌進 PNG。實測 report-only
   * 階段就是這一條被擋 —— 而且只有在按下匯出時才會出現,平常瀏覽完全看不到。
   */
  it('connect-src 放行 Google Fonts —— 匯出圖片要靠它內嵌字型', () => {
    const connect = csp?.match(/connect-src[^;]*/)?.[0] ?? ''
    expect(connect).toContain('https://fonts.googleapis.com')
    expect(connect).toContain('https://fonts.gstatic.com')
  })
})
