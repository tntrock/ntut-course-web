import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { teacherCoursesQueryOptions, teachersQueryOptions } from '@/hooks/useBrowse'
import { CourseList } from '@/components/browse/CourseList'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'

export const Route = createFileRoute('/teacher/$semester/$teacherId')({
  loader: async ({ context, params }) => {
    const { semester, teacherId } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    await Promise.all([
      context.queryClient.ensureQueryData(
        teacherCoursesQueryOptions(meta, semester, teacherId),
      ),
      context.queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
    ])
  },
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
  const { data: meta } = useMeta()

  const response = useSuspenseQuery(
    teacherCoursesQueryOptions(meta, semester, teacherId),
  ).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))

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
      <CourseList
        courses={response.courses}
        semester={semester}
        periods={meta.periods}
      />
    </DetailShell>
  )
}
