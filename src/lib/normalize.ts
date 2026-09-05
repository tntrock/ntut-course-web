/**
 * 搜尋用的字串正規化。
 *
 * 為什麼需要:實測 115-1 的課名裡,`(一)` 有 332 門用半形括號、31 門用全形括號,
 * 同一類課程兩種寫法混用。教師姓名也有 `Keerthana K. B.`、中間夾兩個空白的中文名。
 * 使用者不可能知道資料是哪一種寫法,所以兩邊都正規化到同一個形式再比對。
 */

/** 空白:半形、全形、tab、換行。 */
const WHITESPACE = /[\s　]+/gu

/**
 * 標點與符號。用 Unicode property escape 一次涵蓋中英文標點,
 * 不必手動列舉 `（）：，·—` 這些字元。
 */
const PUNCTUATION = /[\p{P}\p{S}]+/gu

/**
 * NFKC → 小寫 → 去空白 → 去標點。
 *
 * NFKC 把全形英數轉半形(`ＡＩ` → `AI`)、全形括號轉半形,
 * 接著標點整批移除,所以 `工程數學（一）` 與 `工程數學(一)` 會得到同一個結果。
 */
export function normalize(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(WHITESPACE, '')
    .replace(PUNCTUATION, '')
}

/**
 * 把查詢字串切成多個查詢詞。**先用空白切,再各自正規化** ——
 * 順序反過來的話空白會先被吃掉,`白敦文 影像` 會變成單一個查詢詞。
 *
 * 正規化後變空的詞會丟掉:使用者只打標點時,空字串會命中所有課。
 */
export function tokenize(query: string | null | undefined): string[] {
  if (!query) return []
  return query
    .split(WHITESPACE)
    .map(normalize)
    .filter((token) => token.length > 0)
}
