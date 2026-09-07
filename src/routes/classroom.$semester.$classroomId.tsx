import { createFileRoute, notFound } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import { capacityQueryOptions, classroomsQueryOptions } from '@/hooks/useBrowse'
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
  // 不擋渲染:全名與座位數是附註,課表才是這一頁的主體
  const capacity = useQuery(capacityQueryOptions(meta)).data
  const classroom = classrooms.classrooms.find((c) => c.id === classroomId)

  if (!classroom) throw notFound()

  const courses = coursesByIds(index.courses, classroom.course_ids)
  const info = capacity?.classrooms[classroomId]

  return (
    <DetailShell
      kind="教室"
      title={classroom.name}
      semester={semester}
      browseTab="classroom"
      sourceUrl={classroom.url}
      meta={
        <>
          {info && (
            <span>
              {info.full_name}
              {info.capacity !== null && (
                <span className="ml-2 tabular-nums">{info.capacity} 個座位</span>
              )}
            </span>
          )}
          {courses.length !== classroom.course_count && (
            <span className="block">
              教室列了 {classroom.course_count} 門，但本學期索引只查得到{' '}
              {courses.length} 門 —— 少的那幾門在索引裡找不到，下面就列不出來。
            </span>
          )}
        </>
      }
    >
      <CourseList courses={courses} semester={semester} periods={meta.periods} />
    </DetailShell>
  )
}
