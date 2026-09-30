import { replacePrivateUse } from '../src/lib/pua.ts'

/**
 * 解析上游 JSON,並把造字換掉。
 *
 * **這跟 `lib/api.ts` 的 `parse()` 做的是同一件事**,而且非做不可 —— Worker 是
 * 另一條取資料的路徑,前端那一份管不到它。學校原始資料裡有私用區字元(實測
 * 14 位教師的姓名),漏掉就會讓伺服器端產出的 `<title>` 夾著一個在別人裝置上
 * 顯示成豆腐方塊的字元,而那正是分享卡片與搜尋結果會看到的那一份。
 */
export function parseUpstream<T>(text: string): T {
  return JSON.parse(replacePrivateUse(text)) as T
}

/**
 * 從學期索引的**原始文字**裡找出一門課,只解析那一小段。
 *
 * 整份 942 KB 的 `JSON.parse`(加上前面那次造字替換)在 Worker 上實測每個請求
 * 21–36ms CPU,免費方案上限是 10ms。超限是在 Worker 外面被中止的,try/catch
 * 接不住,使用者拿到的是 Cloudflare 的 1102 錯誤頁。
 *
 * 做法:找 `"id":"<課號>"`,往回退到那個物件的 `{`,往前配對到對應的 `}`
 * (跳過字串裡的括號),只解析這一段。**解析出來的 id 對不上就退回整份解析**
 * —— 上游改了欄位順序時會變慢,但不會答錯。
 */
export function findCourse<T extends { id: string }>(
  text: string,
  id: string,
): T | undefined {
  const needle = `"id":${JSON.stringify(id)}`
  const at = text.indexOf(needle)
  if (at === -1) {
    // 找不到有兩種可能:課號真的不存在(爬蟲亂打的,要快),或上游改成了有空白
    // 的排版格式(要走慢路,不然每一門課都會悄悄查無此課)
    if (text.includes('"id":"')) return undefined
    return parseUpstream<{ courses: T[] }>(text).courses.find((c) => c.id === id)
  }

  const start = text.lastIndexOf('{', at)
  const end = start === -1 ? -1 : matchBrace(text, start)
  if (end !== -1) {
    try {
      const hit = parseUpstream<T>(text.slice(start, end + 1))
      if (hit.id === id) return hit
    } catch {
      // 切錯了,走下面的慢路
    }
  }

  return parseUpstream<{ courses: T[] }>(text).courses.find((c) => c.id === id)
}

/** 從 `{` 往後找對應的 `}`,字串裡的括號與跳脫字元不算。找不到回傳 -1。 */
function matchBrace(text: string, open: number): number {
  let depth = 0
  let inString = false
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i
  }
  return -1
}
