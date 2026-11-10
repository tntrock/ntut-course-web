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

/**
 * **沒有 `lastmod`。** 唯一拿得到的時間是上游每天重爬的 `generated_at`,
 * 每一筆都一樣、每天都變 —— 那是在說「全站四千頁每天都改了」,Google 很快就會
 * 判定這個欄位不可信、整份 sitemap 的訊號一起打折。沒有逐頁的真實變動時間,
 * 不寫比亂寫好。
 */
export interface SitemapEntry {
  path: string
}

/**
 * 一個學期裡要送進 sitemap 的東西。
 *
 * **班級頁、教室頁不收。** 它們只是課程清單換個切法,內容跟系所頁、教師頁高度
 * 重疊,約 530 個網址在跟真正有獨特內容的課程頁搶爬取預算。頁面本身照樣可以
 * 從課程頁連過去,只是不主動送。
 */
export interface SemesterContent {
  semester: SemesterPath
  courseIds: readonly string[]
  deptIds: readonly string[]
  teacherIds: readonly string[]
  /** 學程沒有代碼,網址參數就是中文名字。 */
  programNames: readonly string[]
}

/** 要送進 sitemap 的所有網址。 */
export function sitemapEntries(semesters: readonly SemesterContent[]): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({ path }))

  for (const s of semesters) {
    const add = (prefix: string, ids: readonly string[]) => {
      for (const id of ids) entries.push({ path: `/${prefix}/${s.semester}/${id}` })
    }

    add('course', s.courseIds)
    add('dept', s.deptIds)
    add('teacher', s.teacherIds)
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
 * 只寫 `<loc>`:`changefreq` 與 `priority` Google 明講不看,寫了只是讓檔案
 * 變大;`<lastmod>` 為什麼不寫見 `SitemapEntry`。
 */
export function sitemapXml(entries: readonly SitemapEntry[]): string {
  if (entries.length > SITEMAP_MAX_URLS) {
    throw new Error(
      `sitemap 有 ${entries.length} 筆,超過單檔上限 ${SITEMAP_MAX_URLS} 筆。` +
        '要拆成多份並加一份 sitemap index。',
    )
  }

  const urls = entries.map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(canonicalUrl(entry.path))}</loc>\n  </url>`,
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
