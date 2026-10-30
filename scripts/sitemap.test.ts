import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResolvedConfig } from 'vite'

import { sitemap } from './sitemap.ts'

/** build 時的 sitemap 外掛:抓得到資料就產出檔案,抓不到只警告、不擋 build。 */

const SCOPED = { schema_version: 3, year: 115, sem: 1 }

function semester(year: number, sem: number) {
  return { year, sem, path: `${year}-${sem}`, generated_at: `${year}-${sem}T00:00:00Z` }
}

const FILES = {
  'meta.json': {
    latest: '115-1',
    // 故意不照新舊排 —— 文件說不要依賴陣列順序
    semesters: [semester(114, 1), semester(115, 1), semester(114, 2)],
  },
  ...Object.fromEntries(
    ['115-1', '114-2'].flatMap((s) => [
      [`${s}/index.json`, { ...SCOPED, courses: [{ id: `c-${s}` }] }],
      [`${s}/departments.json`, { departments: [{ id: '59' }] }],
      [`${s}/classes.json`, { classes: [{ id: '2501' }] }],
      [`${s}/teachers.json`, { teachers: [{ id: 't1' }] }],
      [`${s}/classrooms.json`, { classrooms: [{ id: 'r1' }] }],
      [`${s}/programs.json`, { programs: [{ name: '人工智慧學程' }] }],
    ]),
  ),
}

/** 這個目錄的 tsconfig 沒有 DOM 型別,所以不借用 `src/test` 的那一份。 */
function fakeFetch(files: Record<string, unknown>) {
  const calls: string[] = []
  const fn = async (url: string) => {
    calls.push(url)
    const key = Object.keys(files).find((k) => url.endsWith(`/${k}`))
    return key === undefined
      ? new Response('not found', { status: 404 })
      : new Response(JSON.stringify(files[key]))
  }
  return Object.assign(fn, { calls })
}

function run(env: Record<string, string> = {}) {
  const plugin = sitemap()
  const logger = { info: vi.fn(), warn: vi.fn() }
  const emitFile = vi.fn()
  ;(plugin.configResolved as (c: ResolvedConfig) => void)({
    env,
    logger,
  } as unknown as ResolvedConfig)
  const done = (plugin.generateBundle as (this: unknown) => Promise<void>).call({
    emitFile,
  })
  return { done, logger, emitFile }
}

afterEach(() => vi.unstubAllGlobals())

describe('sitemap 外掛', () => {
  it('只在 build 時跑', () => {
    expect(sitemap().apply).toBe('build')
  })

  it('收最新兩個學期,不收更舊的', async () => {
    const fetch = fakeFetch(FILES)
    vi.stubGlobal('fetch', fetch)
    const { done, logger, emitFile } = run({ VITE_API_BASE: 'https://api.invalid/' })
    await done

    const xml = emitFile.mock.calls[0]?.[0].source as string
    expect(emitFile.mock.calls[0]?.[0].fileName).toBe('sitemap.xml')
    expect(xml).toContain('/course/115-1/c-115-1')
    expect(xml).toContain('/course/114-2/c-114-2')
    expect(fetch.calls.some((u) => u.includes('114-1/'))).toBe(false)
    // 結尾的斜線不能變成 `//meta.json`
    expect(fetch.calls[0]).toBe('https://api.invalid/meta.json')
    expect(logger.info.mock.calls[0]?.[0]).toContain('115-1、114-2')
  })

  it('抓不到資料時只警告,不擋 build', async () => {
    vi.stubGlobal('fetch', fakeFetch({}))
    const { done, logger, emitFile } = run()
    await expect(done).resolves.toBeUndefined()

    expect(emitFile).not.toHaveBeenCalled()
    expect(logger.warn.mock.calls[0]?.[0]).toContain('產不出 sitemap.xml')
    // 沒設定時用預設的資料來源
    expect(logger.warn.mock.calls[0]?.[0]).toContain('tntrock.github.io')
  })
})
