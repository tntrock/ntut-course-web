/**
 * `index.html` 裡給「不跑 JS 的爬蟲」看的 head 標籤帶的屬性。
 *
 * Bing、LINE、Discord、Facebook 的預覽爬蟲都不執行 JavaScript,只看原始 HTML。
 * 這個站是純前端渲染,所以每個網址拿到的 HTML 一模一樣 —— 那份靜態標題與敘述
 * 是它們唯一看得到的東西,不能拿掉。
 */
export const FALLBACK_ATTR = 'data-head-fallback'

/**
 * 瀏覽器跑起 JS 之後,把那些後備標籤拿掉,交給路由層的 `<HeadContent />`。
 *
 * **一定要真的移除,不能只是再加一個。** HTML 規範規定 `document.title` 讀的是
 * head 裡**第一個** `<title>` 的內容,而 React 對 `<title>` 沒有去重(原始碼裡
 * 它的 hoistable resource 直接回傳 `null`),只會往 head 後面再 append 一個。
 * 靜態那份留著,每一頁的標題就都會被它吃掉,而且是**靜默**失敗 —— 畫面、
 * console 都不會有任何異狀,只有分頁標題永遠是「北科課程」。
 *
 * `<meta name="description">` 同理:同名的 meta 出現兩次,爬蟲取哪一個是未定義的。
 */
export function dropHeadFallback(doc: Document = document): void {
  for (const el of doc.querySelectorAll(`[${FALLBACK_ATTR}]`)) el.remove()
}
