import type { Plugin, ResolvedConfig } from 'vite'

import { sitemapEntries, sitemapXml, type SemesterContent } from '../src/lib/sitemap.ts'
import type {
  ClassesResponse,
  ClassroomsResponse,
  CourseIndex,
  DepartmentsResponse,
  Meta,
  ProgramsResponse,
  SemesterPath,
  TeachersResponse,
} from '../src/types/api.ts'

/**
 * 收幾個學期。
 *
 * **不是全部 51 個。** 全站的網址空間約 15 萬個(51 學期 × 約 2,600 門課,
 * 加上系所、班級、教師、教室、學程),對一個新網域的爬取預算差了好幾個量級 ——
 * 送一份爬不完的清單,只會讓真正重要的本學期課程排在後面。
 *
 * 兩個學期約 8,500 個網址,單檔上限 50,000,還有很多餘裕。
 */
const SEMESTER_COUNT = 2

/**
 * 資料來源。
 *
 * **這裡重複了 `src/lib/api.ts` 的預設值。** 那邊讀的是 `import.meta.env`,
 * 而 Vite 設定檔不是走 app 那條打包路徑,沒有那個東西。值不一致的話 build
 * 會立刻 404,不是那種會默默錯下去的重複。
 */
const DEFAULT_API_BASE = 'https://tntrock.github.io/ntut-course-crawler'

async function getJson<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base}/${path}`)
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`)
  return (await response.json()) as T
}

/** 由新到舊排。`meta.semesters` 本來就是這個順序,但文件說不要依賴它。 */
function newestFirst(meta: Meta) {
  return [...meta.semesters].sort((a, b) => b.year - a.year || b.sem - a.sem)
}

async function collect(base: string, semester: SemesterPath, lastmod: string) {
  const [index, departments, classes, teachers, classrooms, programs] =
    await Promise.all([
      getJson<CourseIndex>(base, `${semester}/index.json`),
      getJson<DepartmentsResponse>(base, `${semester}/departments.json`),
      getJson<ClassesResponse>(base, `${semester}/classes.json`),
      getJson<TeachersResponse>(base, `${semester}/teachers.json`),
      getJson<ClassroomsResponse>(base, `${semester}/classrooms.json`),
      getJson<ProgramsResponse>(base, `${semester}/programs.json`),
    ])

  return {
    semester,
    lastmod,
    courseIds: index.courses.map((c) => c.id),
    deptIds: departments.departments.map((d) => d.id),
    classIds: classes.classes.map((c) => c.id),
    teacherIds: teachers.teachers.map((t) => t.id),
    classroomIds: classrooms.classrooms.map((c) => c.id),
    programNames: programs.programs.map((p) => p.name),
  } satisfies SemesterContent
}

/**
 * build 時產生 `sitemap.xml`。
 *
 * **為什麼是 build 時而不是放在 `public/`:** 每個學期的課程隨爬蟲每天變動,
 * 手寫的清單第一天就過期了。Cloudflare 每次部署都會重跑 build,所以產出的
 * 這一份至少跟那次部署一樣新。
 *
 * **抓不到資料時只警告、不擋 build。** sitemap 是加分項,為了它讓整個網站
 * 部署不出去不成比例 —— 但警告要大聲,不然沒人會發現少了一份。
 */
export function sitemap(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'ntut-sitemap',
    apply: 'build',

    configResolved(resolved) {
      config = resolved
    },

    async generateBundle() {
      const base = (config.env.VITE_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, '')

      try {
        const meta = await getJson<Meta>(base, 'meta.json')
        const sorted = newestFirst(meta)
        const start = sorted.findIndex((s) => s.path === meta.latest)
        const picked = sorted.slice(
          Math.max(start, 0),
          Math.max(start, 0) + SEMESTER_COUNT,
        )

        const contents = await Promise.all(
          picked.map((s) => collect(base, s.path, s.generated_at)),
        )

        const entries = sitemapEntries(contents)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: sitemapXml(entries),
        })

        const range = picked.map((s) => s.path).join('、')
        config.logger.info(`sitemap.xml：${entries.length} 個網址（${range}）`)
      } catch (error) {
        config.logger.warn(
          `\n⚠ 產不出 sitemap.xml，這次部署會少一份：${String(error)}\n` +
            `  網站其餘部分不受影響。資料來源是 ${base}。\n`,
        )
      }
    },
  }
}
