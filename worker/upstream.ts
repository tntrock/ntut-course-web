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
