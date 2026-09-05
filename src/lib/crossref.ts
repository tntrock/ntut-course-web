import type { CourseIndexEntry } from '@/types/api'

/**
 * 拿課號到索引裡取課程。
 *
 * `programs.json` 與 `classrooms.json` 只給課號,沒有課程內容 ——
 * 學程頁與教室頁都要走這一步。索引本來就為了搜尋而載入,所以不多一個請求。
 *
 * 查不到的課號**跳過**而不是留一個洞:陣列裡混進 `undefined` 會讓渲染直接爆掉。
 * 實測 115-1 全部查得到,但那是這一版資料的狀態,不是 API 的承諾。
 */
export function coursesByIds(
  courses: readonly CourseIndexEntry[],
  ids: readonly string[],
): CourseIndexEntry[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const found: CourseIndexEntry[] = []

  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const course = byId.get(id)
    if (course) found.push(course)
  }

  return found
}
