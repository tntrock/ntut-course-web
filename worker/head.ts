import {
  DYNAMIC_PAGES,
  STATIC_PAGES,
  describeCourse,
  mergeHead,
  pageHead as page,
  siteHead,
  type HeadTags,
} from '../src/lib/seo.ts'
import type { CourseIndex } from '../src/types/api.ts'

/**
 * 一頁的完整 head。
 *
 * **一定要疊上 `siteHead()`。** 前端不必這麼做(router 會把根路由的那組一起
 * 算進去),但 Worker 是自己把標籤畫成字串的 —— 只給 `pageHead()` 的話,
 * 伺服器端輸出會沒有 og:image 與 og:site_name,分享卡片就缺圖。
 */
function pageHead(options: Parameters<typeof page>[0]): HeadTags {
  return mergeHead(page(options), siteHead())
}

/** 抓一份上游 JSON。由呼叫端提供,測試才能塞假的進來。 */
export type GetJson = <T>(path: string) => Promise<T>

/**
 * 學期字串。**這是不可信的輸入** —— 它會被接進上游 API 的網址,
 * 不擋的話 `/course/..%2F..%2Fx/1` 就會變成打去別條路徑的請求。
 */
const SEMESTER = /^\d{2,3}-\d$/

/** 代碼類的參數。同樣會進網址,只放行不會把路徑打斷的字元。 */
const ID = /^[A-Za-z0-9_-]+$/

/**
 * 某個路徑在伺服器端該有的 head 標籤。
 *
 * 回傳 `null` 代表「不要動 `index.html`」—— 認不得的路徑、查不到的課程、
 * 格式不對的參數都算。**寧可留著站台預設值,也不要猜一個標題出來。**
 */
export async function headForPath(
  pathname: string,
  getJson: GetJson,
): Promise<HeadTags | null> {
  // 尾端斜線是同一頁,但根目錄的那一條要留
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  // `Object.hasOwn` 不能省 —— 物件字面值繼承 `Object.prototype`,少了它
  // `'constructor'` 之類的鍵會拿到原型上的函式(truthy),被當成認得的頁面
  const staticPage = Object.hasOwn(STATIC_PAGES, path)
    ? STATIC_PAGES[path as keyof typeof STATIC_PAGES]
    : undefined
  if (staticPage) return pageHead({ ...staticPage, path })

  const parts = path.split('/')
  // ['', kind, semester, id] —— 動態頁一律是這個形狀
  if (parts.length !== 4) return null
  const [, kind, semester, rawId] = parts
  if (!kind || !semester || !rawId || !SEMESTER.test(semester)) return null

  // 學程的參數是中文名字,其餘是代碼
  const id = safeDecode(rawId)
  if (id === null) return null
  if (kind !== 'program' && !ID.test(id)) return null

  // 名字、課程數都在各自的清單檔裡;學程沒有清單,名字就是路由參數本身
  const LISTS = {
    teacher: [`${semester}/teachers.json`, 'teachers'],
    dept: [`${semester}/departments.json`, 'departments'],
    class: [`${semester}/classes.json`, 'classes'],
    classroom: [`${semester}/classrooms.json`, 'classrooms'],
  } as const

  if (kind === 'course') return courseHead(semester, id, getJson)

  if (kind === 'program') {
    // 學程沒有代碼,網址參數就是名字本身 —— 但課程數還是要抓,不然爬蟲看到的
    // 敘述跟渲染後的不一樣。`programs.json` gzip 只有 4 KB
    const programs = await getJson<{
      programs: { name: string; course_ids: string[] }[]
    }>(`${semester}/programs.json`)
    const program = programs.programs.find((p) => p.name === id)
    if (!program) return null

    return pageHead({
      ...DYNAMIC_PAGES.program({
        name: id,
        semester,
        count: program.course_ids.length,
      }),
      path,
    })
  }

  if (!(kind in LISTS)) return null
  const [source, key] = LISTS[kind as keyof typeof LISTS]
  const found = await lookup(getJson, source, key, id)
  if (!found) return null

  return pageHead({
    ...DYNAMIC_PAGES[kind as keyof typeof LISTS]({
      name: found.name,
      semester,
      count: found.course_count,
    }),
    path,
  })
}

/** `decodeURIComponent` 對壞掉的百分比編碼會丟例外,那種輸入直接當作不認得。 */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** 清單檔裡的一筆。四份清單的形狀在這三個欄位上是一致的。 */
interface ListItem {
  id: string
  name: string
  course_count?: number
}

/** 從一份清單裡找出某個代碼那一筆。 */
async function lookup(
  getJson: GetJson,
  path: string,
  key: string,
  id: string,
): Promise<ListItem | null> {
  const data = await getJson<Record<string, ListItem[]>>(path)
  return data[key]?.find((item) => item.id === id) ?? null
}

async function courseHead(
  semester: string,
  courseId: string,
  getJson: GetJson,
): Promise<HeadTags | null> {
  const index = await getJson<CourseIndex>(`${semester}/index.json`)
  const course = index.courses.find((c) => c.id === courseId)
  if (!course) return null

  return pageHead({
    subject: `${course.name_zh} ${semester}`,
    /*
     * **班級名單這裡給空的。** 索引只有 `class_ids`(代碼),要拿到「資工四」
     * 這種名字得再抓一次系所課程檔 —— 為了敘述結尾那一句多打一趟 900 KB
     * 不划算。前端渲染完的版本有完整的,Google 看的是那一份。
     */
    description: describeCourse({ ...course, classes: [] }, semester),
    path: `/course/${semester}/${courseId}`,
  })
}
