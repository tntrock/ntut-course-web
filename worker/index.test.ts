import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './index.ts'

/**
 * **這些測試不驗改寫本身,驗的是「出事的時候會怎樣」。**
 *
 * 真正的 workerd 測試要 `@cloudflare/vitest-pool-workers`,但它目前只支援
 * vitest ^4.1,而這個專案在 5.0 —— 沒有相容的版本。改寫結果本身由
 * `render.test.ts`(產生的 HTML)與 `wrangler dev` 的端對端檢查涵蓋;
 * 這裡補的是那幾條「壞掉時走哪裡」的路,因為那正是實際出過事的地方。
 */

const SHELL =
  '<!doctype html><html><head><title>北科課程</title></head><body></body></html>'

function html(body = SHELL): Response {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function makeEnv(asset: () => Response) {
  return {
    ASSETS: { fetch: vi.fn(async () => asset()) },
    CF_VERSION_METADATA: { id: 'v1', tag: '', timestamp: '' },
  } as unknown as Parameters<typeof worker.fetch>[1]
}

const ctx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext

beforeEach(() => {
  // workerd 的全域,在 vitest 裡要自己補
  vi.stubGlobal('caches', {
    default: { match: vi.fn(async () => undefined), put: vi.fn(async () => undefined) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('worker fetch — 出事時的退路', () => {
  /**
   * **這是實際踩過的那個坑。** `run_worker_first` 之下沒有「Worker 掛了就退回
   * 靜態資產」這回事:丟出去的例外就是使用者看到的 500,而且是每一頁。
   */
  it('內部丟例外時送出原本的資產,不是 500', async () => {
    vi.stubGlobal(
      'HTMLRewriter',
      class {
        on() {
          throw new Error('模擬改寫失敗')
        }
      },
    )

    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/about'),
      makeEnv(html),
      ctx,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(SHELL)
  })

  it('快取層丟例外時也一樣', async () => {
    vi.stubGlobal('caches', {
      default: {
        match: vi.fn(async () => {
          throw new Error('快取壞了')
        }),
        put: vi.fn(),
      },
    })

    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/about'),
      makeEnv(html),
      ctx,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(SHELL)
  })
})

describe('worker fetch — 不該碰的東西原封不動', () => {
  it('非 HTML 直接送回去,連快取都不查', async () => {
    const json = () =>
      new Response('{"a":1}', { headers: { 'content-type': 'application/json' } })
    const env = makeEnv(json)

    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/sitemap.xml'),
      env,
      ctx,
    )

    expect(await response.text()).toBe('{"a":1}')
    expect(caches.default.match).not.toHaveBeenCalled()
  })

  it('非 GET 不改寫', async () => {
    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/about', { method: 'POST' }),
      makeEnv(html),
      ctx,
    )

    expect(await response.text()).toBe(SHELL)
  })

  it('認不得的路徑不改寫 —— 站台預設的後備標籤留著', async () => {
    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/nope'),
      makeEnv(html),
      ctx,
    )

    expect(await response.text()).toBe(SHELL)
  })
})

describe('worker fetch — 快取命中', () => {
  it('命中就直接回,不重新改寫', async () => {
    const cached = new Response('CACHED', {
      headers: { 'content-type': 'text/html' },
    })
    vi.stubGlobal('caches', {
      default: { match: vi.fn(async () => cached), put: vi.fn() },
    })

    const response = await worker.fetch(
      new Request('https://ntut-course.allenyen.net/about'),
      makeEnv(html),
      ctx,
    )

    expect(await response.text()).toBe('CACHED')
  })

  /**
   * 鍵要同時含資產的 ETag 與 Worker 的版本號。少了版本號,「改了 Worker、
   * 沒動前端」的部署會繼續送一小時的舊改寫結果 —— 這也是實際踩過的。
   */
  it('快取鍵同時含 ETag 與 Worker 版本號', async () => {
    const withEtag = () =>
      new Response(SHELL, {
        headers: { 'content-type': 'text/html', etag: '"abc123"' },
      })

    await worker.fetch(
      new Request('https://ntut-course.allenyen.net/nope'),
      makeEnv(withEtag),
      ctx,
    )

    const key = vi.mocked(caches.default.match).mock.calls[0]?.[0] as Request
    expect(key.url).toContain('v1')
    expect(key.url).toContain(encodeURIComponent('"abc123"'))
    expect(key.url).toContain('/nope')
  })
})
