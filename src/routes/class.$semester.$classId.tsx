import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { classCoursesQueryOptions } from '@/hooks/useBrowse'
import { SCHOOL_WIDE } from '@/lib/browse'
import { CourseList } from '@/components/browse/CourseList'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'

export const Route = createFileRoute('/class/$semester/$classId')({
  loader: async ({ context, params }) => {
    const { semester, classId } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    await context.queryClient.ensureQueryData(
      classCoursesQueryOptions(meta, semester, classId),
    )
  },
  component: ClassPage,
  errorComponent: ClassMissing,
  notFoundComponent: ClassMissing,
})

function ClassMissing() {
  const { semester, classId } = Route.useParams()
  return <DetailNotFound kind="班級" id={classId} semester={semester} />
}

function ClassPage() {
  const { semester, classId } = Route.useParams()
  const { data: meta } = useMeta()

  const response = useSuspenseQuery(
    classCoursesQueryOptions(meta, semester, classId),
  ).data
  const group = response.class_group

  return (
    <DetailShell
      kind="班級"
      title={group.name}
      semester={semester}
      // 班級沒有自己的瀏覽分頁 —— 它展開在系所底下
      browseTab="dept"
      sourceUrl={group.url}
      meta={
        <div className="flex flex-wrap items-center gap-x-2">
          <Link
            to="/dept/$semester/$deptId"
            params={{ semester, deptId: group.department_id }}
            className="underline underline-offset-4"
          >
            {group.department_name}
          </Link>
          <span>·</span>
          <span>{group.college ?? SCHOOL_WIDE}</span>
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
