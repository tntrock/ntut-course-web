import { createFileRoute, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import { programsQueryOptions } from '@/hooks/useBrowse'
import { coursesByIds } from '@/lib/crossref'
import { CourseList } from '@/components/browse/CourseList'
import { DetailNotFound, DetailShell } from '@/components/browse/DetailShell'

export const Route = createFileRoute('/program/$semester/$programName')({
  /**
   * 學程**沒有代碼,只有中文名**,所以路由參數就是名字本身。
   *
   * 實測 86 個學程裡 27 個含括號、破折號、底線或全形【】,但沒有任何一個含
   * `/` `?` `#` —— 那些才會真的把路徑打斷。編解碼交給 router,這裡只負責比對。
   */
  loader: async ({ context, params }) => {
    const { semester, programName } = params
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    // 學程檔只有課號,課程內容要回索引查 —— 兩份沒有相依,並行取
    const [programs] = await Promise.all([
      context.queryClient.ensureQueryData(programsQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(semesterIndexQueryOptions(meta, semester)),
    ])

    if (!programs.programs.some((p) => p.name === programName)) throw notFound()
  },
  component: ProgramPage,
  errorComponent: ProgramMissing,
  notFoundComponent: ProgramMissing,
})

function ProgramMissing() {
  const { semester, programName } = Route.useParams()
  return (
    <DetailNotFound
      kind="學程"
      id={programName}
      semester={semester}
      hint="學程只有中文名沒有代碼，名稱改過的話舊連結就會失效。"
    />
  )
}

function ProgramPage() {
  const { semester, programName } = Route.useParams()
  const { data: meta } = useMeta()

  const programs = useSuspenseQuery(programsQueryOptions(meta, semester)).data
  const index = useSemesterIndex(meta, semester)
  const program = programs.programs.find((p) => p.name === programName)

  if (!program) throw notFound()

  const courses = coursesByIds(index.courses, program.course_ids)

  return (
    <DetailShell
      kind="學程"
      title={program.name}
      semester={semester}
      browseTab="program"
      meta={
        // 學程檔說有幾門、索引裡查得到幾門,不一致時要看得出來而不是默默少幾門
        courses.length === program.course_count ? null : (
          <span>
            學程列了 {program.course_count} 門，但本學期索引只查得到 {courses.length} 門
            —— 少的那幾門在索引裡找不到，下面就列不出來。
          </span>
        )
      }
    >
      <CourseList courses={courses} semester={semester} periods={meta.periods} />
    </DetailShell>
  )
}
