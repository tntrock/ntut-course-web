import { FALLBACK_ATTR, type HeadTags } from '../src/lib/seo.ts'

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
