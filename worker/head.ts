import {
  DYNAMIC_PAGES,
  STATIC_PAGES,
  describeCourse,
  mergeHead,
  pageHead as page,
  siteHead,
  SITE_NAME,
  type HeadTags,
} from '../src/lib/seo.ts'
import type { CourseIndexEntry, Syllabus } from '../src/types/api.ts'
import {
  renderCourseBody,
  renderCourseList,
  renderIntro,
  renderLinkSection,
  renderSiteNav,
  type PageLink,
} from './render.ts'
import { findCourse, listCourses, listTeachers, parseUpstream } from './upstream.ts'

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

/**
 * 抓一份上游檔案的**原始文字**。由呼叫端提供,測試才能塞假的進來。
 *
 * 給文字而不是解析好的 JSON:課程頁要從 942 KB 的索引裡切出一門課,
 * 整份解析的 CPU 會超過免費方案的上限(見 `findCourse`)。
 */
export type GetText = (path: string) => Promise<string>

type GetJson = <T>(path: string) => Promise<T>

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
  getText: GetText,
): Promise<HeadTags | null> {
  const getJson: GetJson = async (p) => parseUpstream(await getText(p))

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

  if (kind === 'course') {
    const course = findCourse<CourseIndexEntry>(
      await getText(`${semester}/index.json`),
      id,
    )
    return course ? courseHead(course, semester, id) : null
  }

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

/**
 * 一頁的伺服器端輸出。
 *
 * **每一頁都有 `body`,而且結尾都是站內導覽**(見 `renderSiteNav`)。以前只有
 * 課程、教師、系所頁有內文,首頁與瀏覽頁的 `#root` 是空的 —— 原始 HTML 裡
 * 從首頁出發一個連結都沒有,整個站只能靠 sitemap 被發現。
 */
export interface PageParts {
  head: HeadTags
  body: string
}

const COURSE_PATH = /^\/course\/([^/]+)\/([^/]+)\/*$/

/** 跟 `headForPath` 一樣,但多帶一份給 `#root` 的內文。 */
export async function pageForPath(
  pathname: string,
  getText: GetText,
): Promise<PageParts | null> {
  // head 與 body 會要同一份清單檔(例如 `departments.json`),同一個請求只抓一次
  const pending = new Map<string, Promise<string>>()
  const get: GetText = (path) => {
    let hit = pending.get(path)
    if (!hit) pending.set(path, (hit = getText(path)))
    return hit
  }

  const [, semester, id] = COURSE_PATH.exec(pathname) ?? []
  if (semester && id && SEMESTER.test(semester) && ID.test(id)) {
    const page = await coursePage(semester, id, get)
    return page && { head: page.head, body: page.body + renderSiteNav() }
  }
  const head = await headForPath(pathname, get)
  if (!head) return null

  // 清單抓不到只是少了連結:退回標題加敘述,head 照樣送,更不能變成 404
  const body = await pageBody(pathname, head, get).catch(() => undefined)
  return {
    head,
    body: (body ?? renderIntro(headingOf(head), descriptionOf(head))) + renderSiteNav(),
  }
}

/** 標題跟這一頁的 <title> 同一份,去掉站名。首頁的標題就是站名,原樣留著。 */
function headingOf(head: HeadTags): string {
  const title = head.meta.find((m) => 'title' in m)
  return (title && 'title' in title ? title.title : SITE_NAME).replace(
    `｜${SITE_NAME}`,
    '',
  )
}

function descriptionOf(head: HeadTags): string {
  const hit = head.meta.find((m) => 'name' in m && m.name === 'description')
  return hit && 'content' in hit ? hit.content : ''
}

/** 有課程清單檔的頁面,以及那份檔案在上游的位置。 */
const LIST_FILES = { teacher: 'teachers', dept: 'courses' } as const

/**
 * 各種頁面專屬的 `#root` 內文。沒有專屬內文的頁面回 `undefined`,
 * 由呼叫端補上標題加敘述。
 *
 * 只在 `headForPath` 認得這一頁之後才呼叫,學期與代碼都驗過了。
 */
async function pageBody(
  pathname: string,
  head: HeadTags,
  getText: GetText,
): Promise<string | undefined> {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/') return homeBody(head, getText)
  if (path === '/browse') return browseBody(head, getText)

  const [, kind, semester, rawId] = path.split('/')
  if (!kind || !semester || !rawId) return undefined

  let courses: { id: string; name: string }[]
  if (kind === 'program') {
    // 學程沒有自己的課程清單檔,只有課號 —— 課名要回學期索引裡撈
    const name = safeDecode(rawId)
    const { programs } = parseUpstream<{
      programs: { name: string; course_ids: string[] }[]
    }>(await getText(`${semester}/programs.json`))
    const ids = new Set(programs.find((p) => p.name === name)?.course_ids)
    if (ids.size === 0) return undefined
    courses = listCourses(await getText(`${semester}/index.json`), ids)
  } else if (kind in LIST_FILES) {
    const dir = LIST_FILES[kind as keyof typeof LIST_FILES]
    courses = listCourses(await getText(`${semester}/${dir}/${rawId}.json`))
  } else {
    return undefined
  }

  if (courses.length === 0) return undefined
  return renderCourseList(headingOf(head), semester, courses)
}

interface Named {
  id: string
  name: string
}

async function latestSemester(getText: GetText): Promise<string> {
  const { latest } = parseUpstream<{ latest: string }>(await getText('meta.json'))
  // 會被接進上游網址與連結,跟路徑上的學期一樣要驗
  if (!SEMESTER.test(latest)) throw new Error(`meta.latest 格式不對：${latest}`)
  return latest
}

async function departmentLinks(
  semester: string,
  getText: GetText,
): Promise<PageLink[]> {
  const { departments } = parseUpstream<{ departments: Named[] }>(
    await getText(`${semester}/departments.json`),
  )
  return departments.map((d) => ({
    href: `/dept/${semester}/${encodeURIComponent(d.id)}`,
    text: d.name,
  }))
}

/**
 * 首頁:最新學期的每個開課單位。
 *
 * 這是原始 HTML 連結圖的**根** —— 首頁 → 系所頁 → 課程頁 → 教師頁,
 * 不跑 JS 也能從 `/` 走到 sitemap 裡的每一頁。
 */
async function homeBody(head: HeadTags, getText: GetText): Promise<string> {
  const semester = await latestSemester(getText)
  return renderIntro(
    headingOf(head),
    descriptionOf(head),
    renderLinkSection(
      `${semester} 學期開課單位`,
      await departmentLinks(semester, getText),
    ),
  )
}

/** 瀏覽頁:系所、學程、教師三份清單,跟前端這一頁列的是同一批。 */
async function browseBody(head: HeadTags, getText: GetText): Promise<string> {
  const semester = await latestSemester(getText)
  // 三份各自抓;少一份就少一段,不要整頁退回只有敘述
  const [departments, programs, teachers] = await Promise.all([
    departmentLinks(semester, getText).catch(() => []),
    getText(`${semester}/programs.json`).then(
      (text) =>
        parseUpstream<{ programs: { name: string }[] }>(text).programs.map((p) => ({
          href: `/program/${semester}/${encodeURIComponent(p.name)}`,
          text: p.name,
        })),
      () => [],
    ),
    getText(`${semester}/teachers.json`).then(
      (text) =>
        listTeachers(text).map((t) => ({
          href: `/teacher/${semester}/${encodeURIComponent(t.id)}`,
          text: t.name,
        })),
      () => [],
    ),
  ])
  return renderIntro(
    headingOf(head),
    descriptionOf(head),
    renderLinkSection(`${semester} 學期系所`, departments) +
      renderLinkSection(`${semester} 學期學程`, programs) +
      renderLinkSection(`${semester} 學期教師`, teachers),
  )
}

async function coursePage(
  semester: string,
  courseId: string,
  getText: GetText,
): Promise<PageParts | null> {
  const [indexText, syllabus, departments] = await Promise.all([
    getText(`${semester}/index.json`),
    // 約 30% 的課沒有大綱,上游回 404 —— 那就只畫課程資訊
    getText(`${semester}/syllabus/${courseId}.json`).then(
      (text) => parseUpstream<Syllabus>(text),
      () => null,
    ),
    // 系所名只是為了連回系所頁,抓不到就不畫那一行
    getText(`${semester}/departments.json`).then(
      (text) => parseUpstream<{ departments: Named[] }>(text).departments,
      () => [],
    ),
  ])
  const course = findCourse<CourseIndexEntry>(indexText, courseId)
  if (!course) return null

  const ids = new Set(course.department_ids)
  return {
    head: courseHead(course, semester, courseId),
    body: renderCourseBody(
      course,
      semester,
      syllabus,
      departments.filter((d) => ids.has(d.id)),
    ),
  }
}

function courseHead(
  course: CourseIndexEntry,
  semester: string,
  courseId: string,
): HeadTags {
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
