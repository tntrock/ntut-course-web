import { describe, expect, it } from 'vitest'
import { dropHeadFallback } from './headFallback'
import { FALLBACK_ATTR } from './seo'

function makeHead(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head>${html}</head><body></body></html>`,
    'text/html',
  )
}

describe('dropHeadFallback', () => {
  it('拿掉標記過的標籤', () => {
    const doc = makeHead(
      `<title ${FALLBACK_ATTR}>北科課程</title>` +
        `<meta ${FALLBACK_ATTR} name="description" content="靜態敘述" />`,
    )

    dropHeadFallback(doc)

    expect(doc.head.querySelector('title')).toBeNull()
    expect(doc.head.querySelector('meta[name="description"]')).toBeNull()
  })

  it('沒標記的不動 —— charset、viewport、字型那些要留著', () => {
    const doc = makeHead(
      `<meta charset="UTF-8" /><title ${FALLBACK_ATTR}>北科課程</title>` +
        `<link rel="stylesheet" href="/a.css" />`,
    )

    dropHeadFallback(doc)

    expect(doc.head.querySelector('meta[charset]')).not.toBeNull()
    expect(doc.head.querySelector('link[rel="stylesheet"]')).not.toBeNull()
  })

  /**
   * 這是整件事的理由。HTML 規範說 `document.title` 讀的是 head 裡**第一個**
   * `<title>`,而 React 只會在後面再加一個,不會取代既有的那個 —— 靜態那份
   * 留著,每一頁的標題就都會被它吃掉。
   */
  it('拿掉之後,後來加上的 title 才算數', () => {
    const doc = makeHead(`<title ${FALLBACK_ATTR}>北科課程</title>`)

    const added = doc.createElement('title')
    added.textContent = '網路與系統安全｜北科課程'
    doc.head.appendChild(added)
    expect(doc.title).toBe('北科課程') // 還沒拿掉,第一個贏

    dropHeadFallback(doc)

    expect(doc.title).toBe('網路與系統安全｜北科課程')
  })

  it('沒有標記過的標籤時不出錯', () => {
    const doc = makeHead('<meta charset="UTF-8" />')
    expect(() => dropHeadFallback(doc)).not.toThrow()
  })
})
