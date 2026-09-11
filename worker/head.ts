import {
  STATIC_PAGES,
  describeCourse,
  mergeHead,
  pageHead as page,
  siteHead,
  type HeadTags,
} from '../src/lib/seo.ts'
import type {
  ClassesResponse,
  ClassroomsResponse,
  CourseIndex,
  DepartmentsResponse,
  TeachersResponse,
} from '../src/types/api.ts'

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

  const staticPage = STATIC_PAGES[path as keyof typeof STATIC_PAGES]
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

  switch (kind) {
    case 'course':
      return courseHead(semester, id, getJson)
    case 'teacher':
      return simpleHead(
        await lookup<TeachersResponse>(
          getJson,
          `${semester}/teachers.json`,
          (d) => d.teachers,
          id,
        ),
        (name) => ({
          subject: `${name} 老師`,
          description: `臺北科技大學 ${name} 老師開授的課程一覽，含學分、上課時段、修課人數與退選率。`,
          path,
        }),
      )
    case 'dept':
      return simpleHead(
        await lookup<DepartmentsResponse>(
          getJson,
          `${semester}/departments.json`,
          (d) => d.departments,
          id,
        ),
        (name) => ({
          subject: `${name} ${semester}`,
          description: `臺北科技大學${name} ${semester} 學期的開課清單，含學分、上課時段與授課教師。`,
          path,
        }),
      )
    case 'class':
      return simpleHead(
        await lookup<ClassesResponse>(
          getJson,
          `${semester}/classes.json`,
          (d) => d.classes,
          id,
        ),
        (name) => ({
          subject: `${name} ${semester}`,
          description: `臺北科技大學${name}在 ${semester} 學期的課程，含必選修、學分與上課時段。`,
          path,
        }),
      )
    case 'classroom':
      return simpleHead(
        await lookup<ClassroomsResponse>(
          getJson,
          `${semester}/classrooms.json`,
          (d) => d.classrooms,
          id,
        ),
        (name) => ({
          subject: `${name} ${semester}`,
          description: `臺北科技大學 ${name} 在 ${semester} 學期的課表，哪些時段有課、哪些時段是空的。`,
          path,
        }),
      )
    case 'program':
      // 學程沒有代碼,網址參數就是名字本身 —— 不必抓任何東西
      return pageHead({
        subject: `${id} ${semester}`,
        description: `臺北科技大學「${id}」在 ${semester} 學期的課程一覽。`,
        path,
      })
    default:
      return null
  }
}

/** `decodeURIComponent` 對壞掉的百分比編碼會丟例外,那種輸入直接當作不認得。 */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** 從一份清單裡找出某個代碼的名字。 */
async function lookup<T>(
  getJson: GetJson,
  path: string,
  pick: (data: T) => readonly { id: string; name: string }[],
  id: string,
): Promise<string | null> {
  const data = await getJson<T>(path)
  return pick(data).find((item) => item.id === id)?.name ?? null
}

function simpleHead(
  name: string | null,
  build: (name: string) => Parameters<typeof page>[0],
): HeadTags | null {
  return name === null ? null : pageHead(build(name))
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
