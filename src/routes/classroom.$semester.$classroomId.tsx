import { createFileRoute, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import { classroomsQueryOptions } from '@/hooks/useBrowse'
import { coursesByIds } from '@/lib/crossref'
import { CourseList } from '@/components/browse/CourseList'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'

export const Route = createFileRoute('/classroom/$semester/$classroomId')({
  loader: async ({ context, params }) => {
    const { semester, classroomId } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    // 教室檔只有課號,課程內容要回索引查 —— 兩份沒有相依,並行取
    const [classrooms] = await Promise.all([
      context.queryClient.ensureQueryData(classroomsQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(semesterIndexQueryOptions(meta, semester)),
    ])

    if (!classrooms.classrooms.some((c) => c.id === classroomId)) throw notFound()
  },
  component: ClassroomPage,
  errorComponent: ClassroomMissing,
  notFoundComponent: ClassroomMissing,
})

function ClassroomMissing() {
  const { semester, classroomId } = Route.useParams()
  return <DetailNotFound kind="教室" id={classroomId} semester={semester} />
}

function ClassroomPage() {
  const { semester, classroomId } = Route.useParams()
  const { data: meta } = useMeta()

  const classrooms = useSuspenseQuery(classroomsQueryOptions(meta, semester)).data
  const index = useSemesterIndex(meta, semester)
  const classroom = classrooms.classrooms.find((c) => c.id === classroomId)

  if (!classroom) throw notFound()

  const courses = coursesByIds(index.courses, classroom.course_ids)

  return (
    <DetailShell
      kind="教室"
      title={classroom.name}
      semester={semester}
      browseTab="classroom"
      sourceUrl={classroom.url}
      meta={
        courses.length === classroom.course_count ? null : (
          <span>
            教室列了 {classroom.course_count} 門，但本學期索引只查得到 {courses.length}{' '}
            門 —— 少的那幾門在索引裡找不到，下面就列不出來。
          </span>
        )
      }
    >
      <CourseList courses={courses} semester={semester} periods={meta.periods} />
    </DetailShell>
  )
}
