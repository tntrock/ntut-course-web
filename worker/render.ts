import { FALLBACK_ATTR, type HeadTags } from '../src/lib/seo.ts'
import type { CourseIndexEntry, Syllabus } from '../src/types/api.ts'

/**
 * 把 head 標籤畫成 HTML,準備塞進 `index.html`。
 *
 * **每個標籤都帶 `data-head-fallback`。** 這是伺服器端注入能跟前端共存的關鍵:
 * 瀏覽器一跑起 JS,`dropHeadFallback()` 就把這些清掉、換成路由層那一份。
 * 少了這個標記,同一個 head 裡會出現兩個 title 與兩個 description ——
 * 而瀏覽器只認第一個,等於前端的版本永遠不會生效。
 */
export function renderHead({ meta, links }: HeadTags): string {
  const parts: string[] = []

  for (const tag of meta) {
    if ('title' in tag) {
      parts.push(`<title ${FALLBACK_ATTR}>${escapeText(tag.title)}</title>`)
    } else if ('name' in tag) {
      parts.push(attrTag('meta', { name: tag.name, content: tag.content }))
    } else {
      parts.push(attrTag('meta', { property: tag.property, content: tag.content }))
    }
  }

  for (const link of links) {
    parts.push(attrTag('link', { rel: link.rel, href: link.href }))
  }

  return parts.join('')
}

function attrTag(name: string, attrs: Record<string, string>): string {
  const rendered = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ')
  return `<${name} ${FALLBACK_ATTR} ${rendered}>`
}

/**
 * 課名、教師姓名都是學校那邊來的字串,不是我們控制的內容 —— 一律當成不可信,
 * 直接接進 HTML 就是注入。
 */
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;')
}

const MAIN_OPEN = `<main class="mx-auto max-w-3xl px-4 py-8">`

/** 一個站內連結。`href` 由呼叫端組好(代碼要先 `encodeURIComponent`)。 */
export interface PageLink {
  href: string
  text: string
}

/**
 * 每一頁伺服器端內文結尾都掛的站內導覽。
 *
 * **沒有這一段,原始 HTML 的連結圖是斷的。** 課程頁、教師頁、系所頁彼此有連,
 * 但沒有任何一頁連回首頁或瀏覽頁,首頁自己更是一個連結都沒有 —— 不跑 JS 的話,
 * 從 `/` 出發一頁都走不到,整份 sitemap 對 Google 來說是 3,700 個孤兒頁。
 * 只在 sitemap 出現、站內沒人連的網址,正是「已找到 - 目前尚未建立索引」的典型。
 */
const SITE_NAV: readonly PageLink[] = [
  { href: '/', text: '北科課程首頁' },
  { href: '/browse', text: '瀏覽系所、教師與學程' },
  { href: '/search', text: '搜尋課程' },
  { href: '/withdrawal', text: '退選率' },
  { href: '/changes', text: '課程異動' },
  { href: '/rooms', text: '空教室' },
  { href: '/about', text: '關於' },
]

function linkItems(links: readonly PageLink[]): string {
  return links
    .map((l) => `<li><a href="${escapeAttr(l.href)}">${escapeText(l.text)}</a></li>`)
    .join('')
}

export function renderSiteNav(): string {
  return (
    `<nav aria-label="網站導覽" class="mx-auto max-w-3xl px-4 pb-8">` +
    `<ul>${linkItems(SITE_NAV)}</ul></nav>`
  )
}

/** 一段有標題的連結清單。沒有連結就整段不畫,不留空標題。 */
export function renderLinkSection(title: string, links: readonly PageLink[]): string {
  if (links.length === 0) return ''
  return `<section><h2>${escapeText(title)}</h2><ul>${linkItems(links)}</ul></section>`
}

/**
 * 沒有專屬內文的頁面的 `#root` 內容:標題、敘述,加上呼叫端給的段落。
 *
 * 文字跟這一頁的 `<title>` / description 是同一份,不是另外寫給爬蟲的。
 * `sections` 是**已經畫好的 HTML**(`renderLinkSection` 的輸出),這裡不再跳脫。
 */
export function renderIntro(
  heading: string,
  description: string,
  sections = '',
): string {
  return (
    MAIN_OPEN +
    `<h1>${escapeText(heading)}</h1>` +
    (description ? `<p>${escapeText(description)}</p>` : '') +
    sections +
    `</main>`
  )
}

/**
 * 教師頁、系所頁、學程頁的 `#root` 內容:一串連到課程頁的 `<a>`。
 *
 * **要的是連結,不是內文。** 這幾種頁面本身只是課程清單,真正值得收錄的是課程頁
 * —— 但原始 HTML 裡沒有任何連到課程頁的連結,Google 得排隊等 JS 渲染才找得到,
 * 結果整份 sitemap 停在「已找到 - 目前尚未建立索引」。跟 `renderCourseBody`
 * 一樣,React 掛載時會整個換掉。
 */
export function renderCourseList(
  heading: string,
  semester: string,
  courses: readonly { id: string; name: string }[],
): string {
  const items = courses.map(
    (c) =>
      `<li><a href="/course/${escapeAttr(semester)}/${encodeURIComponent(c.id)}">` +
      `${escapeText(c.name)}</a>(${escapeText(c.id)})</li>`,
  )
  return (
    MAIN_OPEN + `<h1>${escapeText(heading)}</h1>` + `<ul>${items.join('')}</ul></main>`
  )
}

/** `renderCourseBody` 需要的課程欄位 —— 輕量索引就有,不必再抓系所檔。 */
type CourseFacts = Pick<
  CourseIndexEntry,
  | 'id'
  | 'name_zh'
  | 'teachers'
  | 'teacher_codes'
  | 'time_slots'
  | 'credits'
  | 'required'
>

/** 大綱裡要畫出來的段落。**不含 `teacher_email`** —— 放進 HTML 就是送給垃圾信爬蟲。 */
const SYLLABUS_SECTIONS = [
  ['outline', '課程大綱'],
  ['schedule', '課程進度'],
  ['assessment', '評量方式'],
  ['materials', '教材'],
] as const

/**
 * 課程頁的 `<div id="root">` 內容,給爬蟲看的**真正內文**。
 *
 * **為什麼不能只靠 head:** Search Console 長期把課程頁列為「已檢索 - 目前尚未
 * 建立索引」。原始 HTML 的 body 是空的,內容要等 JS 去 GitHub Pages 跑三趟請求;
 * 而唯一有獨特內容的大綱只在 `?tab=syllabus` 才渲染,canonical 又把查詢字串丟了
 * —— Google 看到的八千多頁幾乎是同一個模板,判成內容太薄。
 *
 * React 的 `createRoot` 第一次 commit 就會清掉容器,所以這段只活到 JS 接手為止,
 * 不會跟前端的畫面疊在一起。內容跟前端顯示的是同一份資料,不是給爬蟲另一套。
 */
export function renderCourseBody(
  course: CourseFacts,
  semester: string,
  syllabus: Pick<
    Syllabus,
    'has_content' | (typeof SYLLABUS_SECTIONS)[number][0]
  > | null,
  /** 開課單位。有給就連到系所頁 —— 課程頁往上走的唯一一條路。 */
  departments: readonly { id: string; name: string }[] = [],
): string {
  const facts: string[] = [`<li>學期：${escapeText(semester)}</li>`]

  if (departments.length > 0) {
    const links = departments.map(
      (d) =>
        `<a href="/dept/${escapeAttr(semester)}/${encodeURIComponent(d.id)}">${escapeText(d.name)}</a>`,
    )
    facts.push(`<li>開課單位：${links.join('、')}</li>`)
  }

  if (course.teachers.length > 0) {
    const links = course.teachers.map((name, i) => {
      const code = course.teacher_codes[i]
      return code
        ? `<a href="/teacher/${escapeAttr(semester)}/${encodeURIComponent(code)}">${escapeText(name)}</a>`
        : escapeText(name)
    })
    facts.push(`<li>授課教師：${links.join('、')}</li>`)
  }
  if (course.credits !== null) facts.push(`<li>學分：${course.credits}</li>`)
  if (course.required !== null)
    facts.push(`<li>${course.required ? '必修' : '選修'}</li>`)
  if (course.time_slots.length > 0) {
    const slots = course.time_slots.map(
      (s) => `週${s.day_name} ${s.periods.join('、')} 節`,
    )
    facts.push(`<li>上課時段：${escapeText(slots.join('；'))}</li>`)
  }

  const sections = syllabus?.has_content
    ? SYLLABUS_SECTIONS.flatMap(([key, label]) => {
        const text = syllabus[key]?.trim()
        return text
          ? [`<h2>${label}</h2><p style="white-space:pre-line">${escapeText(text)}</p>`]
          : []
      })
    : []

  return (
    MAIN_OPEN +
    `<h1>${escapeText(course.name_zh)}</h1>` +
    `<p>臺北科技大學 ${escapeText(semester)} 學期課程，課號 ${escapeText(course.id)}。</p>` +
    `<ul>${facts.join('')}</ul>` +
    sections.join('') +
    `</main>`
  )
}
