import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { departmentCoursesQueryOptions } from '@/hooks/useBrowse'
import { isCollegeWideUnit, SCHOOL_WIDE } from '@/lib/browse'
import { CourseList } from '@/components/browse/CourseList'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'

export const Route = createFileRoute('/dept/$semester/$deptId')({
  loader: async ({ context, params }) => {
    const { semester, deptId } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    // 系所檔本身就帶 `department`,但它沒有 `class_groups`,所以對照表還是要
    await Promise.all([
      context.queryClient.ensureQueryData(
        departmentCoursesQueryOptions(meta, semester, deptId),
      ),
      context.queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
    ])
  },
  component: DeptPage,
  errorComponent: DeptMissing,
  notFoundComponent: DeptMissing,
})

function DeptMissing() {
  const { semester, deptId } = Route.useParams()
  return <DetailNotFound kind="系所" id={deptId} semester={semester} />
}

function DeptPage() {
  const { semester, deptId } = Route.useParams()
  const { data: meta } = useMeta()

  const response = useSuspenseQuery(
    departmentCoursesQueryOptions(meta, semester, deptId),
  ).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const dept = departments.departments.find((d) => d.id === deptId)

  const college = response.department.college ?? SCHOOL_WIDE

  return (
    <DetailShell
      kind="系所"
      title={response.department.name}
      semester={semester}
      browseTab="dept"
      sourceUrl={response.department.url}
      meta={
        <>
          <span>{college}</span>
          {/* 名字和上層學院一模一樣的單位，不講清楚沒人分得出差別 */}
          {dept && isCollegeWideUnit(dept) && (
            <p className="mt-1 text-xs">
              這是院級共同課程，不是{college}底下所有系所的課。
            </p>
          )}
        </>
      }
    >
      {dept && dept.class_groups.length > 0 && (
        <section className="mb-4">
          <h2 className="text-muted-foreground mb-1.5 text-xs font-medium">班級</h2>
          <div className="flex flex-wrap gap-1">
            {dept.class_groups.map((c) => (
              <Link
                key={c.id}
                to="/class/$semester/$classId"
                params={{ semester, classId: c.id }}
                className="hover:bg-accent rounded-full border px-2.5 py-1 text-xs"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <CourseList
        courses={response.courses}
        semester={semester}
        periods={meta.periods}
      />
    </DetailShell>
  )
}
