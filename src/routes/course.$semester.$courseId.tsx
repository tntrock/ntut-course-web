import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/course/$semester/$courseId')({
  component: CourseDetail,
})

/** Phase 2 才會做完整的詳情頁與教學大綱。先給一個不會斷掉的落點。 */
function CourseDetail() {
  const { semester, courseId } = Route.useParams()

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">課程 {courseId}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {semester} 學期。詳情頁與教學大綱建置中。
      </p>
      <Link to="/search" className="mt-6 inline-block text-sm underline">
        回搜尋
      </Link>
    </div>
  )
}
