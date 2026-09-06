/**
 * 瀏覽頁的四個分頁。
 *
 * 放在 `lib/` 是因為它同時被兩邊用:瀏覽頁自己(網址參數要驗證),以及五個明細頁
 * 的返回連結(`DetailShell` 的 `browseTab`)。各寫一份聯集型別的話,加一個分頁
 * 就得記得改兩個地方。
 */

export const BROWSE_TABS = ['dept', 'teacher', 'program', 'classroom'] as const

export type BrowseTab = (typeof BROWSE_TABS)[number]

export const BROWSE_TAB_LABELS: Record<BrowseTab, string> = {
  dept: '系所',
  teacher: '教師',
  program: '學程',
  classroom: '教室',
}

export function isBrowseTab(value: unknown): value is BrowseTab {
  return BROWSE_TABS.includes(value as BrowseTab)
}
