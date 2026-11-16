import { FALLBACK_ATTR, SITE_URL } from '../src/lib/seo.ts'
import { pageForPath } from './head.ts'
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
  CF_VERSION_METADATA: WorkerVersionMetadata
}

/**
 * 在靜態資產前面補上逐頁的 `<head>`。
 *
 * **為什麼需要這一層:** 這個站是純前端渲染,每個網址回傳的 HTML 都一樣。
 * Googlebot 會執行 JS 所以看得到前端那份逐頁 head,但 LINE、Discord、
 * Facebook、Bing 的預覽爬蟲**完全不跑 JS** —— 對它們來說每一頁都叫「北科課程」。
 * 學生是用貼連結在傳這個站的,所以這半邊的實際效益比 Google 那半邊高。
 *
 * **每一頁的 `#root` 也都有內文。** 課程頁是課名、教師、時段、大綱(見
 * `renderCourseBody`),清單類的頁面是連結,而且每一頁結尾都有站內導覽 ——
 * 原始 HTML 要自己構成一張走得通的連結圖,理由見 `renderSiteNav`。
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return offCanonicalHost(request, await rewrite(request, env, ctx))
    } catch {
      /*
       * **最後一道防線。**
       *
       * `run_worker_first` 之下沒有「Worker 掛了就退回靜態資產」這回事 ——
       * 丟出去的例外就是使用者看到的 500,而且是**每一頁**,不是只有 meta 標籤
       * 不見。實測過:在這裡故意丟一個例外,`/` 與所有課程頁全部變成
       * `HTTP 500 text/plain`。
       *
       * 這一層做的事只是「加幾個 meta 標籤」,不值得讓整個站陪葬。
       */
      return offCanonicalHost(request, await env.ASSETS.fetch(request))
    }
  },
} satisfies ExportedHandler<Env>

/** 正式網域。只有這個主機名稱上的頁面該被收錄。 */
const CANONICAL_HOST = new URL(SITE_URL).hostname

/**
 * 不是正式網域就標上 `noindex`。
 *
 * 同一個 Worker 也掛在 `*.workers.dev` 與每次部署的預覽網址上,內容一模一樣。
 * canonical 雖然指回正式網域,但那只是「建議」—— 整站多一份完全重複的內容,
 * Google 得花爬取額度去確認它是重複的,而新站的額度本來就少。
 *
 * **在快取外面做**:快取鍵沒有主機名稱,兩邊共用同一份改寫結果。
 */
function offCanonicalHost(request: Request, response: Response): Response {
  if (new URL(request.url).hostname === CANONICAL_HOST) return response
  const copy = new Response(response.body, response)
  copy.headers.set('x-robots-tag', 'noindex')
  return copy
}

/** 真正的改寫流程。任何一步出錯都由上面那層接住。 */
async function rewrite(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const asset = await env.ASSETS.fetch(request)

  // 只碰 HTML。JS、CSS、圖、sitemap 原封不動送回去
  if (!(asset.headers.get('content-type') ?? '').includes('text/html')) return asset
  if (request.method !== 'GET') return asset

  const url = new URL(request.url)

  /*
   * 快取鍵 = 資產的 ETag + Worker 的版本號 + 路徑。
   *
   * **兩個版本號都要。** ETag 跟著 `index.html` 走,前端一改就換;但只有它
   * 的話,「改了 Worker、沒動前端」的那種部署會繼續送一小時的舊改寫結果 ——
   * 實測踩過:修好造字的那次部署完,已經被快取的教師頁還是舊的。
   */
  const etag = asset.headers.get('etag') ?? 'none'
  const version = env.CF_VERSION_METADATA.id
  const cacheKey = new Request(
    `https://head.invalid/${version}/${encodeURIComponent(etag)}${url.pathname}`,
  )
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached

  let html: string
  let body: string
  try {
    const page = await pageForPath(url.pathname, (path) => getText(API_BASE, path))
    if (!page) return notFound(asset)
    html = renderHead(page.head)
    body = page.body
  } catch (error) {
    // 學期不存在:上游那份檔案就是 404,跟查不到課是同一件事
    if (error instanceof UpstreamNotFound) return notFound(asset)
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
      // 這一頁的內文與站內連結,給爬蟲看。React 掛載時會整個換掉,見 `renderCourseBody`
      .on('#root', {
        element: (root) => {
          root.setInnerContent(body, { html: true })
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
}

/**
 * 認不得的網址:內容照舊送 `index.html`(前端會畫「查無此頁」),但狀態碼給 404。
 *
 * **不能回 200。** SPA fallback 讓任何網址都回同一個空殼,Google 把這種頁判成
 * soft 404 / 重複內容,並據此調低整個網域的爬取意願 —— Search Console 長期把
 * 整份 sitemap 列為「已找到 - 目前尚未建立索引」。
 *
 * 上游出錯**不走這裡**(見呼叫端):暫時性的錯誤回 404 會讓真的課程頁被移出索引。
 */
function notFound(asset: Response): Response {
  return new Response(asset.body, { status: 404, headers: asset.headers })
}

/** 上游明確說「沒有這份檔案」,跟上游掛掉分開。 */
class UpstreamNotFound extends Error {}

async function getText(base: string, path: string): Promise<string> {
  const response = await fetch(`${base}/${path}`, {
    cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true },
  })
  if (response.status === 404) throw new UpstreamNotFound(path)
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`)
  return response.text()
}
