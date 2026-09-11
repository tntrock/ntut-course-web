import { FALLBACK_ATTR } from '../src/lib/seo.ts'
import { headForPath } from './head.ts'
import { parseUpstream } from './upstream.ts'
import { renderHead } from './render.ts'

/**
 * 資料來源。
 *
 * 跟 `scripts/sitemap.ts` 一樣是重複的預設值 —— Worker 沒有 `import.meta.env`。
 * 這裡刻意**不**讀環境變數:`.env` 是本機的 Vite 設定,不會存在於 Cloudflare
 * 的建置環境,讀了只會拿到 undefined 而且型別上看不出來。真的要改的話,
 * 在 `wrangler.jsonc` 加一個 `vars`。
 */
const API_BASE = 'https://tntrock.github.io/ntut-course-crawler'

/** 上游 JSON 在邊緣放多久。meta 標籤晚一小時反映新資料完全無所謂。 */
const UPSTREAM_TTL = 3600

/** 改寫後的 HTML 在邊緣放多久。 */
const PAGE_TTL = 3600

interface Env {
  ASSETS: Fetcher
}

/**
 * 在靜態資產前面補上逐頁的 `<head>`。
 *
 * **為什麼需要這一層:** 這個站是純前端渲染,每個網址回傳的 HTML 都一樣。
 * Googlebot 會執行 JS 所以看得到前端那份逐頁 head,但 LINE、Discord、
 * Facebook、Bing 的預覽爬蟲**完全不跑 JS** —— 對它們來說每一頁都叫「北科課程」。
 * 學生是用貼連結在傳這個站的,所以這半邊的實際效益比 Google 那半邊高。
 *
 * **body 不動。** 只改 head:內容還是前端渲染,這一層只負責讓「不會渲染的
 * 讀者」拿到正確的標題、敘述與分享卡片。
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const asset = await env.ASSETS.fetch(request)

    // 只碰 HTML。JS、CSS、圖、sitemap 原封不動送回去
    if (!(asset.headers.get('content-type') ?? '').includes('text/html')) return asset
    if (request.method !== 'GET') return asset

    const url = new URL(request.url)

    /*
     * 快取鍵包含資產的 ETag。
     *
     * 少了它,新部署要等 s-maxage 過期才看得到 —— 使用者會拿到舊的 app shell,
     * 那比少一個 meta 標籤嚴重得多。ETag 跟著 `index.html` 的內容走,
     * 一部署就換,舊的項目自己過期。
     */
    const etag = asset.headers.get('etag') ?? 'none'
    const cacheKey = new Request(
      `https://head.invalid/${encodeURIComponent(etag)}${url.pathname}`,
    )
    const cached = await caches.default.match(cacheKey)
    if (cached) return cached

    let html: string
    try {
      const tags = await headForPath(url.pathname, (path) => getJson(API_BASE, path))
      if (!tags) return asset
      html = renderHead(tags)
    } catch {
      // 上游掛掉、格式變了,就當作沒有這一層。`index.html` 自己帶著站台層級的
      // 後備標籤,退回去仍然是可以用的一頁
      return asset
    }

    const response = new Response(
      new HTMLRewriter()
        // 先清掉 `index.html` 自己那份站台層級的後備標籤,不然會變成兩個 title
        .on(`[${FALLBACK_ATTR}]`, {
          element: (el) => {
            el.remove()
          },
        })
        .on('head', {
          element: (head) => {
            head.onEndTag((end) => {
              end.before(html, { html: true })
            })
          },
        })
        .transform(asset).body,
      asset,
    )

    // 內容改過了,原本那個 ETag 不再成立
    response.headers.delete('etag')
    // 瀏覽器每次都回來問(部署要能立刻生效),邊緣自己擋住重複的改寫
    response.headers.set('cache-control', `public, max-age=0, s-maxage=${PAGE_TTL}`)

    ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
    return response
  },
} satisfies ExportedHandler<Env>

async function getJson<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base}/${path}`, {
    cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true },
  })
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`)
  return parseUpstream<T>(await response.text())
}
