import type { Course, SemesterPath } from '@/types/api'

/**
 * 標記「這是給不跑 JS 的讀者看的後備標籤」。
 *
 * `index.html` 的靜態標籤與 Worker 注入的標籤都帶著它,瀏覽器一跑起 JS 就
 * 由 `dropHeadFallback()` 清掉,換成路由層那一份。
 *
 * **放在這裡而不是 `headFallback.ts`**,因為那個檔案會碰 `document`,
 * 而 Cloudflare Worker 沒有 DOM —— 它只需要這個字串。
 */
export const FALLBACK_ATTR = 'data-head-fallback'

/** 網站名稱。標題結尾一律掛這個。 */
export const SITE_NAME = '北科課程'

/**
 * 正式網址。
 *
 * **canonical 與 og:url 一定要絕對網址**,相對路徑會被爬蟲忽略。這裡寫死而不是
 * 讀 `location.origin` —— 預覽部署、localhost 都不該把自己宣告成正式網址。
 */
export const SITE_URL = 'https://ntut-course.allenyen.net'

/** 分享卡片的圖。PWA 圖示是 512×512 的方形,配 `summary` 卡片剛好。 */
const OG_IMAGE = `${SITE_URL}/icon-512.png`

/**
 * 路由 `head()` 能回傳的標籤。
 *
 * 型別故意收得比 router 的還窄:這個站只需要 title / name / property 三種,
 * 開放整個 `<meta>` 的屬性集合只會讓呼叫端有機會寫出 router 不會 dedupe 的東西
 * (它是用 `name ?? property` 當鍵去重的,兩者都沒有的標籤會重複出現)。
 */
export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }

export interface HeadTags {
  meta: MetaTag[]
  links: { rel: string; href: string }[]
}

/**
 * 分頁標題。
 *
 * 主題是空的就只回站名 —— 資料缺欄位時產出「｜北科課程」很難看,而且那個
 * 前導分隔線在搜尋結果裡會被當成標題的一部分。
 */
export function pageTitle(subject?: string | null): string {
  const trimmed = subject?.trim()
  return trimmed ? `${trimmed}｜${SITE_NAME}` : SITE_NAME
}

/**
 * 某個路徑的正規網址。
 *
 * 用 `URL` 而不是字串相接,是為了**編碼**:學程路由的參數就是中文名字,
 * `URL` 會把非 ASCII 百分比編碼,又不會去動已經編碼過的 `%XX`(自己寫
 * `encodeURIComponent` 就會把 `%E5` 變成 `%25E5`)。
 *
 * 查詢字串一律丟掉 —— `?tab=syllabus`、`?range=y3` 這些都是同一頁的不同檢視,
 * 留著會讓同一份內容產生無限多個網址。
 */
export function canonicalUrl(path: string): string {
  const url = new URL(path, SITE_URL)
  url.search = ''
  url.hash = ''
  // 尾端斜線去掉,但根目錄的那一條要留
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return url.href
}

export interface PageHeadOptions {
  /** 標題的主題部分,不含站名。 */
  subject?: string | null | undefined
  description?: string | null | undefined
  /** 這一頁的路徑,用來算 canonical。 */
  path: string
  /** 擋掉收錄。無限網址空間的頁面(搜尋結果)與純本機資料的頁面(課表)要開。 */
  noindex?: boolean | undefined
}

/**
 * 單一頁面的 head 標籤。
 *
 * **只放這一頁獨有的東西。** 站台層級的 og:site_name / og:image 之類在
 * `siteHead()`,由根路由提供:router 以 `name ?? property` 去重且**深層優先**,
 * 所以子路由只要覆蓋自己要改的那幾個就好。
 *
 * canonical 是例外 —— link 標籤只做「整個標籤完全相同」的去重,不是照 `rel`。
 * 根路由跟子路由各給一個 canonical 的話,兩個都會出現在 head 裡,那比沒有還糟。
 * 所以 canonical **只有這裡產**,`siteHead()` 不碰。
 */
export function pageHead({
  subject,
  description,
  path,
  noindex,
}: PageHeadOptions): HeadTags {
  const href = canonicalUrl(path)
  const text = description?.trim()
  const title = subject?.trim()

  const meta: MetaTag[] = [{ title: pageTitle(title) }]

  if (text) meta.push({ name: 'description', content: text })
  // follow 要留著:搜尋頁本身沒有收錄價值,但它連出去的課程頁有
  if (noindex) meta.push({ name: 'robots', content: 'noindex, follow' })

  // og:title 不掛站名 —— og:site_name 已經另外講了一次,掛了會變成
  // 「網路與系統安全｜北科課程 · 北科課程」
  meta.push({ property: 'og:title', content: title || SITE_NAME })
  if (text) meta.push({ property: 'og:description', content: text })
  meta.push({ property: 'og:url', content: href })

  return { meta, links: [{ rel: 'canonical', href }] }
}

/**
 * 站台層級的預設值,由根路由提供。
 *
 * 這些每一頁都一樣,放在根路由讓子路由不必重複;子路由要改的(標題、敘述)
 * 覆蓋掉就好。
 */
export function siteHead(): HeadTags {
  return {
    meta: [
      { title: SITE_NAME },
      { property: 'og:title', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'zh_TW' },
      { property: 'og:image', content: OG_IMAGE },
      // 沒有橫幅圖,用方形小圖的版型;宣告成 large_image 會被裁得很難看
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [],
  }
}

/**
 * 疊合多組 head 標籤,**前面的贏**。
 *
 * 前端不需要這個 —— router 自己會照「深層路由優先」去重。但 Cloudflare Worker
 * 是自己把標籤畫成字串的,得自己把 `pageHead()` 與 `siteHead()` 疊起來:
 * 少了這一步,伺服器端輸出就沒有 og:image 與 og:site_name,分享卡片會缺圖。
 */
export function mergeHead(...groups: readonly HeadTags[]): HeadTags {
  const meta: MetaTag[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const tag of group.meta) {
      // router 也是用 `name ?? property` 當鍵,這裡跟它一致
      const key = 'title' in tag ? 'title' : 'name' in tag ? tag.name : tag.property
      if (seen.has(key)) continue
      seen.add(key)
      meta.push(tag)
    }
  }

  return { meta, links: groups.flatMap((g) => g.links) }
}

/**
 * 沒有動態資料的頁面,各自的標題與敘述。
 *
 * **放在這裡而不是各自的路由檔**,因為 Cloudflare Worker 也要用同一份 ——
 * 它在伺服器端先把 head 寫好給不跑 JS 的爬蟲看,而它 import 不了路由檔
 * (那裡面有 React)。兩份文案遲早會分岔,分岔的那一天不會有人發現。
 */
export const STATIC_PAGES = {
  '/': {
    description:
      '臺北科技大學課程查詢：關鍵字搜尋、系所與時段交叉篩選、教學大綱、空教室、退選率、我的課表。資料每日更新，非官方網站。',
  },
  '/search': {
    subject: '搜尋課程',
    description:
      '以關鍵字、系所、時段、學分、必選修交叉篩選臺北科技大學的課程，條件都留在網址上。',
    noindex: true,
  },
  '/browse': {
    subject: '瀏覽',
    description: '依系所、班級、教師、教室、學程瀏覽臺北科技大學的開課清單。',
  },
  '/withdrawal': {
    subject: '退選率',
    description:
      '臺北科技大學各課程的退選率排行，可依教師或課程彙總，區間從單一學期到近五年。',
  },
  '/changes': {
    subject: '課程異動',
    description: '臺北科技大學課程的新增、停開、時間與授課教師異動紀錄，每日比對更新。',
  },
  '/rooms': {
    subject: '空教室',
    description: '查臺北科技大學指定時段的空教室，可依座位數篩選。',
  },
  '/schedule': {
    subject: '我的課表',
    description: '把課加進課表、檢查衝堂、匯出圖片。課表只存在這台裝置的瀏覽器裡。',
    noindex: true,
  },
  '/about': {
    subject: '關於',
    description: '關於北科課程：資料來源、更新頻率、免責聲明與問題回報方式。',
  },
} as const satisfies Record<string, Omit<PageHeadOptions, 'path'>>

/** 敘述裡最多列幾個班級。 */
const MAX_CLASSES = 3

/**
 * 課程頁的 meta description。
 *
 * **缺的欄位整段跳過。** 體育、班週會這類課沒有學分也沒有班級,套版式地填
 * 「null 學分」會直接出現在搜尋結果裡。
 */
export function describeCourse(
  course: Pick<Course, 'name_zh' | 'teachers' | 'credits' | 'classes' | 'required'>,
  semester: SemesterPath,
): string {
  const parts = [`${semester} 學期「${course.name_zh}」`]

  if (course.teachers.length > 0) parts.push(`由${course.teachers.join('、')}開授`)
  if (course.credits !== null) parts.push(`${course.credits} 學分`)
  if (course.required !== null) parts.push(course.required ? '必修' : '選修')

  if (course.classes.length > 0) {
    // 通識課開給三十幾個班,全列會把敘述撐到被搜尋結果截斷
    const shown = course.classes.slice(0, MAX_CLASSES).join('、')
    parts.push(
      course.classes.length > MAX_CLASSES
        ? `開給${shown} 等 ${course.classes.length} 個班級`
        : `開給${shown}`,
    )
  }

  return `${parts.join('，')}。臺北科技大學課程資訊與教學大綱。`
}
