// **這兩行的副檔名是刻意的**,跟 src/ 其他地方不一樣:這個檔案會被
// `scripts/sitemap.ts` 拉進 Vite 設定檔,而設定檔之後會由 Node 原生載入,
// 那條路徑不做副檔名推斷。
import { canonicalUrl } from './seo.ts'
import type { SemesterPath } from '@/types/api.ts'

/**
 * 固定頁面。
 *
 * **`/search` 與 `/schedule` 不在裡面。** 它們的 `head()` 掛了 `noindex`,
 * 再列進 sitemap 等於一邊說「請收錄」一邊說「不要收錄」—— 搜尋引擎會把整份
 * sitemap 的可信度打折,不只是忽略那兩筆。
 */
export const STATIC_PATHS = [
  '/',
  '/browse',
  '/withdrawal',
  '/changes',
  '/rooms',
  '/about',
] as const

/** sitemap 協定的單檔上限。超過要拆檔並加一份 sitemap index。 */
export const SITEMAP_MAX_URLS = 50000

export interface SitemapEntry {
  path: string
  lastmod?: string | undefined
}

/** 一個學期裡所有有自己網址的東西。 */
export interface SemesterContent {
  semester: SemesterPath
  /** 這個學期資料的產生時間,直接當 `<lastmod>` 用。 */
  lastmod: string
  courseIds: readonly string[]
  deptIds: readonly string[]
  classIds: readonly string[]
  teacherIds: readonly string[]
  classroomIds: readonly string[]
  /** 學程沒有代碼,網址參數就是中文名字。 */
  programNames: readonly string[]
}

/**
 * 要送進 sitemap 的所有網址。
 *
 * 固定頁面的 `lastmod` 跟著**最新**那個學期走 —— 首頁、瀏覽頁的內容就是從
 * 最新學期的資料長出來的,學期一更新它們也跟著變。
 */
export function sitemapEntries(semesters: readonly SemesterContent[]): SitemapEntry[] {
  const newest = semesters.map((s) => s.lastmod).sort((a, b) => b.localeCompare(a))[0]

  const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({
    path,
    lastmod: newest,
  }))

  for (const s of semesters) {
    const add = (prefix: string, ids: readonly string[]) => {
      for (const id of ids) {
        entries.push({ path: `/${prefix}/${s.semester}/${id}`, lastmod: s.lastmod })
      }
    }

    add('course', s.courseIds)
    add('dept', s.deptIds)
    add('class', s.classIds)
    add('teacher', s.teacherIds)
    add('classroom', s.classroomIds)
    // 中文名字要編碼,不然產出的不是合法網址
    add('program', s.programNames.map(encodeURIComponent))
  }

  // 同一個路徑只留第一筆。資料裡出現重複的代碼是有可能的,而重複的 <loc>
  // 會讓整份 sitemap 被判為無效
  const seen = new Set<string>()
  return entries.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)))
}

/** XML 文字節點的跳脫。`&` 在路徑裡是合法字元,不會被百分比編碼掉。 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 產生 `sitemap.xml`。
 *
 * 只寫 `<loc>` 與 `<lastmod>`:`changefreq` 與 `priority` Google 明講不看,
 * 寫了只是讓檔案變大。
 */
export function sitemapXml(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_MAX_URLS) {
    throw new Error(
      `sitemap 有 ${entries.length} 筆,超過單檔上限 ${SITEMAP_MAX_URLS} 筆。` +
        '要拆成多份並加一份 sitemap index。',
    )
  }

  const urls = entries.map((entry) => {
    const loc = `    <loc>${escapeXml(canonicalUrl(entry.path))}</loc>`
    // 空的 <lastmod> 會讓整份被判為無效,沒有就整個不寫
    const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''
    return `  <url>\n${loc}${lastmod}\n  </url>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
