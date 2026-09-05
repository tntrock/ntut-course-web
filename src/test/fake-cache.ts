/**
 * Cache Storage API 的最小記憶體實作,給測試用。
 *
 * 這不是 mock —— 它真的照 CacheStorage 的語意存取資料,測試斷言的是
 * 「第二次呼叫沒有發網路請求」這種**行為**,不是「某個 mock 被呼叫幾次」。
 * jsdom 沒有 `caches`,所以需要它。
 */

class FakeCache {
  private readonly entries = new Map<string, Response>()

  async match(request: RequestInfo): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : request.url
    const hit = this.entries.get(key)
    return hit?.clone()
  }

  async put(request: RequestInfo, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : request.url
    this.entries.set(key, response)
  }

  async delete(request: RequestInfo): Promise<boolean> {
    const key = typeof request === 'string' ? request : request.url
    return this.entries.delete(key)
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url))
  }
}

class FakeCacheStorage {
  private readonly caches = new Map<string, FakeCache>()

  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name)
    if (!cache) {
      cache = new FakeCache()
      this.caches.set(name, cache)
    }
    return cache
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name)
  }
}

/** 裝上假的 `caches`,回傳一個還原用的函式。 */
export function installFakeCaches(): () => void {
  const original = Reflect.get(globalThis, 'caches') as unknown
  Reflect.set(globalThis, 'caches', new FakeCacheStorage())
  return () => {
    Reflect.set(globalThis, 'caches', original)
  }
}

/** 移除 `caches`,模擬無痕視窗 / 舊瀏覽器。 */
export function removeCaches(): () => void {
  const original = Reflect.get(globalThis, 'caches') as unknown
  Reflect.deleteProperty(globalThis, 'caches')
  return () => {
    Reflect.set(globalThis, 'caches', original)
  }
}

export interface FakeFetch {
  (input: RequestInfo | URL): Promise<Response>
  /** 實際打出去的網址,依序記錄。 */
  readonly calls: string[]
}

/**
 * 依網址前綴(不含 query string)供應固定回應的 fetch。
 *
 * @param routes 路徑(不含 base、不含 `?v=`)→ 回應內容或狀態碼
 */
export function createFakeFetch(
  routes: Record<string, unknown | { status: number }>,
): FakeFetch {
  const calls: string[] = []
  const fn = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push(url)
    const pathname = new URL(url).pathname.replace(/^\/+/, '')
    const key = Object.keys(routes).find((r) => pathname.endsWith(r))
    if (key === undefined) {
      return new Response('not found', { status: 404 })
    }
    const value = routes[key]
    if (
      typeof value === 'object' &&
      value !== null &&
      'status' in value &&
      Object.keys(value).length === 1
    ) {
      return new Response('error', { status: (value as { status: number }).status })
    }
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return Object.assign(fn, { calls }) as FakeFetch
}
