import { useEffect } from 'react'
import { useQueries } from '@tanstack/react-query'

import { departmentCoursesQueryOptions } from '@/hooks/useBrowse'
import { updateStore, useStore } from '@/hooks/useStore'
import { departmentsNeedingClassrooms, fillClassrooms } from '@/lib/storeActions'
import type { Meta, SemesterPath } from '@/types/api'

/**
 * 把課表裡缺教室的快照補起來。
 *
 * `{semester}/index.json` **沒有 `classrooms` 欄位** —— 所以從搜尋結果加入的課
 * 一律沒有教室,從詳情頁加入的才有。同一張課表於是有的顯示教室、有的不顯示。
 *
 * 教室只存在系所課程檔裡,補救就得回頭抓那個檔。用「補」而不是「顯示時才查」
 * 有兩個理由:一次修好之後**離線也看得到**,而且匯出的圖不會缺一半。
 *
 * 沒有課缺教室就完全不發請求;抓不到也只是維持現狀,不會讓課表壞掉。
 */
export function useClassroomBackfill(meta: Meta, semester: SemesterPath): void {
  const store = useStore()
  const deptIds = departmentsNeedingClassrooms(store, semester)

  const results = useQueries({
    queries: deptIds.map((id) => ({
      ...departmentCoursesQueryOptions(meta, semester, id),
      // 補教室是次要的事,失敗就算了,不要一直重試
      retry: false,
    })),
  })

  const loaded = results.filter((r) => r.data).flatMap((r) => r.data?.courses ?? [])

  useEffect(() => {
    if (loaded.length === 0) return
    // fillClassrooms 沒有實際變更時回傳原本的參考,所以這裡不會反覆寫入
    updateStore((s) => fillClassrooms(s, semester, loaded))
    // loaded 每次 render 都是新陣列,放進相依陣列會變成無窮迴圈
    // oxlint-disable-next-line exhaustive-deps
  }, [semester, loaded.length])
}
