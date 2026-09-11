import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { teacherRangeQueryOptions, teachersQueryOptions } from '@/hooks/useBrowse'
import { RANGES, rangeSemesters, type Range } from '@/hooks/useWithdrawal'
import { TeacherCourseGroups } from '@/components/browse/TeacherCourseGroups'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'
import { pageHead } from '@/lib/seo'

interface TeacherSearch {
  /**
   * 要看幾個學期。**預設只看網址上的那一個**——從瀏覽頁、課程頁進來的人
   * 本來就在看某一個學期,冒出前幾年的課只會莫名其妙。
   *
   * 退選率頁彙總好幾個學期,連結會帶上它當時的期間,點進來才看得到同一個窗口。
   */
  range?: Range
}

export const Route = createFileRoute('/teacher/$semester/$teacherId')({
  validateSearch: (search: Record<string, unknown>): TeacherSearch =>
    RANGES.includes(search.range as Range) ? { range: search.range as Range } : {},

  loaderDeps: ({ search }) => ({ range: search.range }),

  loader: async ({ context, params, deps }) => {
    const { semester, teacherId } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    const semesters = rangeSemesters(meta, semester, deps.range ?? 'sem')
    const [groups] = await Promise.all([
      context.queryClient.ensureQueryData(
        teacherRangeQueryOptions(meta, semesters, teacherId),
      ),
      context.queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
    ])
    // 整個範圍都查不到才算查無此人 —— 少一個學期是「那學期沒開課」
    if (groups.length === 0) throw notFound()

    // 標題要的是名字,不是代碼。每一組都是同一位老師,取第一組就好
    return { name: groups[0]?.data.teacher.name }
  },

  head: ({ params, loaderData }) =>
    pageHead({
      subject: loaderData?.name && `${loaderData.name} 老師`,
      description:
        loaderData?.name &&
        `臺北科技大學 ${loaderData.name} 老師開授的課程一覽，含學分、上課時段、修課人數與退選率。`,
      path: `/teacher/${params.semester}/${params.teacherId}`,
    }),

  component: TeacherPage,
  errorComponent: TeacherMissing,
  notFoundComponent: TeacherMissing,
})

function TeacherMissing() {
  const { semester, teacherId } = Route.useParams()
  const { data: meta } = useMeta()

  /*
   * 查一下姓名再顯示。**代碼是給機器看的**,「沒有 24622 這位教師」對使用者
   * 沒有任何意義,他要找的是「侯政伯」。
   *
   * 名單瀏覽頁也在用,通常已經在快取裡;查不到就退回代碼,不擋這一頁。
   */
  const teachers = useQuery(teachersQueryOptions(meta, semester)).data
  const name = teachers?.teachers.find((t) => t.id === teacherId)?.name

  return (
    <DetailNotFound
      kind="教師"
      id={teacherId}
      name={name}
      semester={semester}
      browseTab="teacher"
    />
  )
}

function TeacherPage() {
  const { semester, teacherId } = Route.useParams()
  const { range } = Route.useSearch()
  const { data: meta } = useMeta()

  const semesters = rangeSemesters(meta, semester, range ?? 'sem')
  const groups = useSuspenseQuery(
    teacherRangeQueryOptions(meta, semesters, teacherId),
  ).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))

  /*
   * 姓名、系所、學校連結取**最新有開課的那個學期**。老師可能換系,
   * 而 `groups` 已經是由新到舊,第一筆就是最近的。
   *
   * loader 已經保證不會是空的(整個範圍都查不到會 throw notFound),
   * 這裡再判一次是為了讓型別收斂 —— 全專案沒有用過 non-null assertion。
   */
  const newest = groups[0]
  if (!newest) return <TeacherMissing />
  const response = newest.data

  return (
    <DetailShell
      kind="教師"
      title={response.teacher.name}
      semester={semester}
      browseTab="teacher"
      sourceUrl={response.teacher.url}
      meta={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {response.teacher.department_ids.map((id) => (
            <Link
              key={id}
              to="/dept/$semester/$deptId"
              params={{ semester, deptId: id }}
              className="underline underline-offset-4"
            >
              {deptName.get(id) ?? id}
            </Link>
          ))}
          {/*
            實測 803 個教師代碼只有 801 個不同姓名 —— 林志哲與陳盈竹各有兩位。
            代碼是這一頁唯一能證明「你看的是哪一位」的東西，所以要看得見。
          */}
          <span className="text-xs tabular-nums">代碼 {response.teacher.id}</span>
        </div>
      }
    >
      <TeacherCourseGroups
        groups={groups.map((g) => ({ semester: g.semester, courses: g.data.courses }))}
        periods={meta.periods}
      />
    </DetailShell>
  )
}
