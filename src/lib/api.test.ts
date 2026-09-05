import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeFetch, installFakeCaches, removeCaches } from '@/test/fake-cache'

let restoreCaches: () => void

beforeEach(() => {
  restoreCaches = installFakeCaches()
})

afterEach(() => {
  restoreCaches()
  vi.unstubAllGlobals()
})

describe('fetchVersioned', () => {
  it('把版本號附加在網址上並回傳解析後的 JSON', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchVersioned<{ course_count: number }>(
      '115-1/index.json',
      '2026-09-05T03:34:59Z',
    )

    expect(data.course_count).toBe(2717)
    expect(fetchMock.calls).toHaveLength(1)
    expect(fetchMock.calls[0]).toContain('v=2026-09-05T03%3A34%3A59Z')
  })

  it('版本相同時第二次呼叫不發網路請求', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    const second = await fetchVersioned<{ course_count: number }>(
      '115-1/index.json',
      'v1',
    )

    expect(second.course_count).toBe(2717)
    expect(fetchMock.calls).toHaveLength(1)
  })

  it('版本改變時重新下載並拿到新資料', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    await fetchVersioned('115-1/index.json', 'v2')

    expect(fetchMock.calls).toHaveLength(2)
  })

  it('版本改變後清掉同一路徑的舊版本,快取不會無限成長', async () => {
    const { fetchVersioned, API_CACHE_NAME } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/index.json': { course_count: 2717 },
      '114-2/index.json': { course_count: 2809 },
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    await fetchVersioned('114-2/index.json', 'v1')
    await fetchVersioned('115-1/index.json', 'v2')

    const cache = await caches.open(API_CACHE_NAME)
    const urls = (await cache.keys()).map((r) => r.url).sort()

    // 115-1 只留 v2,114-2 的 v1 不受影響
    expect(urls).toHaveLength(2)
    expect(urls.some((u) => u.includes('115-1/index.json?v=v2'))).toBe(true)
    expect(urls.some((u) => u.includes('115-1/index.json?v=v1'))).toBe(false)
    expect(urls.some((u) => u.includes('114-2/index.json?v=v1'))).toBe(true)
  })

  it('回應非 2xx 時丟出帶狀態碼與路徑的 ApiError', async () => {
    const { fetchVersioned, ApiError } = await import('./api')
    vi.stubGlobal('fetch', createFakeFetch({ '115-1/syllabus/1.json': { status: 404 } }))

    const err = await fetchVersioned('115-1/syllabus/1.json', 'v1').catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(ApiError)
    expect((err as InstanceType<typeof ApiError>).status).toBe(404)
    expect((err as InstanceType<typeof ApiError>).path).toBe('115-1/syllabus/1.json')
  })

  it('Cache Storage 不可用時(無痕視窗)仍能正常取得資料', async () => {
    const restore = removeCaches()
    try {
      const { fetchVersioned } = await import('./api')
      const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
      vi.stubGlobal('fetch', fetchMock)

      const data = await fetchVersioned<{ course_count: number }>(
        '115-1/index.json',
        'v1',
      )

      expect(data.course_count).toBe(2717)
      expect(fetchMock.calls).toHaveLength(1)
    } finally {
      restore()
    }
  })
})

describe('fetchMeta', () => {
  const META = { schema_version: 2, latest: '115-1', semesters: [] }

  it('不帶版號,每次都重新取得(meta 本身就是版本的來源)', async () => {
    const { fetchMeta } = await import('./api')
    const fetchMock = createFakeFetch({ 'meta.json': META })
    vi.stubGlobal('fetch', fetchMock)

    await fetchMeta()
    const second = await fetchMeta()

    expect(second.data.latest).toBe('115-1')
    expect(second.fromCache).toBe(false)
    expect(fetchMock.calls).toHaveLength(2)
    expect(fetchMock.calls[0]).not.toContain('?v=')
  })

  it('離線時退回上次快取的 meta,並標示資料非最新', async () => {
    const { fetchMeta } = await import('./api')
    vi.stubGlobal('fetch', createFakeFetch({ 'meta.json': META }))
    await fetchMeta()

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const offline = await fetchMeta()

    expect(offline.data.latest).toBe('115-1')
    expect(offline.fromCache).toBe(true)
  })

  it('離線且沒有快取時丟出錯誤,不會回傳空資料', async () => {
    const { fetchMeta } = await import('./api')
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    await expect(fetchMeta()).rejects.toThrow()
  })
})

describe('semesterVersion', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [
      { path: '115-1', generated_at: '2026-09-05T03:34:59Z' },
      { path: '110-1', generated_at: '2026-09-04T01:19:26Z' },
    ],
  } as unknown as import('@/types/api').Meta

  it('用該學期自己的 generated_at,不是 meta 的', async () => {
    const { semesterVersion } = await import('./api')

    // 舊學期的版本永遠不變 —— 這是「歷史資料只下載一次」的根據
    expect(semesterVersion(meta, '110-1')).toBe('2026-09-04T01:19:26Z')
  })

  it('學期不存在時丟出錯誤,不會默默用錯版本', async () => {
    const { semesterVersion } = await import('./api')

    expect(() => semesterVersion(meta, '99-9')).toThrow(/99-9/)
  })
})

describe('fetchSemesterIndex', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '110-1', generated_at: '2026-09-04T01:19:26Z' }],
  } as unknown as import('@/types/api').Meta

  it('抓舊學期時帶的是該學期的版本號', async () => {
    const { fetchSemesterIndex } = await import('./api')
    const fetchMock = createFakeFetch({ '110-1/index.json': { course_count: 2428 } })
    vi.stubGlobal('fetch', fetchMock)

    const index = await fetchSemesterIndex(meta, '110-1')

    expect(index.course_count).toBe(2428)
    expect(fetchMock.calls[0]).toContain('110-1/index.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-04T01%3A19%3A26Z')
  })
})
