/**
 * 「階段」徽章的文字。沒有東西可顯示時回傳 `null`。
 *
 * **`stage` 不是年級** —— 學校表格的欄位是「課號 | 課程名稱 | 階段 | 學分 | …」,
 * 年級在「班級」那一欄。兩者零相關:資工四的 291 門課 `stage` 全是 `"1"`。
 * 各系所填法也不一致,所以**不猜語意**,學校填什麼就顯示什麼。
 *
 * `"1"` 不顯示 —— 96% 的課都是這個值,擺在每一頁只是雜訊。
 * 完整的實測數字見 `plan.md` §1.7。
 */
export function stageBadge(stage: string | null): string | null {
  const value = stage?.trim()
  if (!value || value === '1') return null
  return `階段 ${value}`
}

/**
 * 這門課有沒有修課人數。
 *
 * **`null` 和「欄位不存在」都算沒有。** 96-1 以前的原始課表沒有「人」「撤」
 * 兩欄,索引裡連鍵都沒有 —— 只比對 `null` 的話 `undefined` 會被當成有值,
 * 畫面上「修課 N 人」的 N 就會整個不見,只剩下一個空位。
 */
export function hasEnrolment(course: { enrolled?: number | null }): boolean {
  return course.enrolled !== null && course.enrolled !== undefined
}
