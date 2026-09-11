import type { Course, SemesterPath } from '@/types/api'

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
