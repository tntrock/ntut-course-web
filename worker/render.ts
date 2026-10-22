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
): string {
  const facts: string[] = [`<li>學期：${escapeText(semester)}</li>`]

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
    `<main class="mx-auto max-w-3xl px-4 py-8">` +
    `<h1>${escapeText(course.name_zh)}</h1>` +
    `<p>臺北科技大學 ${escapeText(semester)} 學期課程，課號 ${escapeText(course.id)}。</p>` +
    `<ul>${facts.join('')}</ul>` +
    sections.join('') +
    `</main>`
  )
}
