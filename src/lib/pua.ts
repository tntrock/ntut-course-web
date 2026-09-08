/**
 * 學校原始資料裡的**造字**（私用區字元）。
 *
 * 實測:教師 23533 在學校頁面上的姓名是 `林` + U+E1B3，原始位元組
 * `E6 9E 97 EE 86 B3`，頁面自己宣告 UTF-8 —— 所以那不是解碼錯誤，
 * 是學校真的把一個罕用字存成自訂碼位。這種字**沒有標準編碼**，
 * 字型檔在學校自己的系統裡，任何瀏覽器都畫不出來，只會顯示一個空方塊。
 *
 * 實測 115-1 全站只有教師姓名有這種字（索引 38 個、教師清單 14 個，
 * 系所 / 班級 / 教室 / 學程 / 異動全部是 0）。
 *
 * **不要試著猜那是什麼字。** 教學大綱裡有這位老師的 email，看起來像是個線索，
 * 但從 email 反推真人的姓名就是編造資料。
 */

/**
 * 私用區。三段都要:基本平面一段，另外兩個補充平面各一段。
 *
 * `u` 旗標是必要的 —— 少了它，補充平面的字會被當成兩個獨立的代理字元，
 * 一個字換出兩個〇。
 */
const PRIVATE_USE = /[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu

/**
 * 顯示不出來的字用「〇」。
 *
 * 這是中文本來就有的用法:字缺了、寫不出來就寫〇。比空方塊好，因為空方塊
 * 讀起來像網站壞了；也比直接刪掉好，刪掉之後「林〇」會變成「林」，
 * 看起來就是個單名的人，錯得更徹底。
 */
export const UNKNOWN_CHAR = '〇'

export function hasPrivateUse(text: string): boolean {
  // 帶 g 旗標的正規表示式有 lastIndex 狀態，test() 連續呼叫會跳著匹配
  PRIVATE_USE.lastIndex = 0
  return PRIVATE_USE.test(text)
}

export function replacePrivateUse(text: string): string {
  return text.replace(PRIVATE_USE, UNKNOWN_CHAR)
}
