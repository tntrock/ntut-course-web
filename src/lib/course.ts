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
