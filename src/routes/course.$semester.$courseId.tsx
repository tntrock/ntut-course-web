import { useState } from 'react'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import {
  courseQueryOptions,
  syllabusProgressQueryOptions,
  syllabusQueryOptions,
} from '@/hooks/useCourseDetail'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { syllabusState } from '@/lib/syllabus'
import { formatSlotClock, formatTimeSlots } from '@/lib/formatTime'
import { LANGUAGE_ZH } from '@/lib/filters'
import { SyllabusPanel } from '@/components/course/SyllabusPanel'
import type { Course, Meta, SemesterPath } from '@/types/api'

interface DetailSearch {
  tab?: 'syllabus'
}

export const Route = createFileRoute('/course/$semester/$courseId')({
  validateSearch: (search: Record<string, unknown>): DetailSearch =>
    search.tab === 'syllabus' ? { tab: 'syllabus' } : {},

  /**
   * 冷啟動(直接開分享連結)的請求安排。實測線上冷快取約 1.25 秒,
   * 其中三個來回就佔了約 700ms —— 這是「沒有 lookup.json」的固有成本
   * (要拿系所代碼就得先載整份索引),plan §9 記了解法。這裡榨乾的是排程:
   *
   * ```
   * meta ─┬─ 索引 ────── 系所檔 ─┐
   *       ├─ 系所對照 ───────────┤ 頁面可以渲染了
   *       └─ 大綱進度 ── 大綱 ─ ─ ─ (不擋渲染,面板自己顯示載入中)
   * ```
   *
   * 兩個刻意的安排:
   *
   * 1. **每個請求在自己的相依項回來的當下就發出**,不等同一輪的其他人。
   *    用 `Promise.all` 分輪的話,系所檔要等比較慢的大綱進度,白等約 100ms。
   * 2. **大綱不進 `await`。** 課程資訊分頁不需要它,而它是最後才會回來的那個。
   *    讓它擋著等於為了一個多數人不會馬上看的分頁,拖慢所有人的首次渲染。
   */
  loader: async ({ context, params }) => {
    const { semester, courseId } = params
    const { queryClient } = context
    const { data: meta } = await queryClient.ensureQueryData(metaQueryOptions())

    if (!meta.semesters.some((s) => s.path === semester)) throw notFound()

    const coursePromise = queryClient
      .ensureQueryData(semesterIndexQueryOptions(meta, semester))
      .then((index) => {
        const entry = index.courses.find((c) => c.id === courseId)
        if (!entry) throw notFound()
        return queryClient.ensureQueryData(courseQueryOptions(meta, semester, entry))
      })

    void queryClient
      .ensureQueryData(syllabusProgressQueryOptions(meta))
      .then((progress) => {
        const version = progress.fetched[semester]?.[courseId]
        if (version === undefined) return null
        return queryClient.ensureQueryData(
          syllabusQueryOptions(semester, courseId, version),
        )
      })

    await Promise.all([
      coursePromise,
      queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
    ])
  },

  component: CourseDetail,
  notFoundComponent: CourseNotFound,
})

function CourseNotFound() {
  const { semester, courseId } = Route.useParams()

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">查無此課</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {semester} 沒有課號 {courseId}。
        {/* 課號跨學期不穩定(plan §1.3.7)—— 這是最常見的原因,直接講出來 */}
        課號在不同學期並不通用,舊連結換到別的學期通常就查不到了。
      </p>
      <Link to="/search" className="mt-6 inline-block text-sm underline">
        回搜尋
      </Link>
    </div>
  )
}

/** 一列「標籤 / 內容」。內容為空就整列不顯示,不要留一排空欄位。 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === false) return null
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3 border-t py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
      {children}
    </span>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="hover:bg-accent focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      {copied ? '已複製' : '複製連結'}
    </button>
  )
}

function CourseDetail() {
  const { semester, courseId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()

  const index = useSemesterIndex(meta, semester)
  const entry = index.courses.find((c) => c.id === courseId)
  // loader 已經擋掉了,這裡只是讓型別收斂
  if (!entry) throw notFound()

  const course = useSuspenseQuery(courseQueryOptions(meta, semester, entry)).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data

  // 大綱進度**不用 suspense** —— 用了就等於重新讓它擋住整頁渲染,
  // 白費 loader 裡把它移出 await 的功夫
  const progress = useQuery(syllabusProgressQueryOptions(meta)).data
  const state = progress
    ? syllabusState(progress, semester, courseId, course.syllabus_url)
    : null

  const syllabus = useQuery({
    ...syllabusQueryOptions(
      semester,
      courseId,
      state?.kind === 'available' ? state.version : 'none',
    ),
    // 沒有大綱檔就不發請求 —— 這是「不靠 404 判斷」那條要求的實作點
    enabled: state?.kind === 'available',
  }).data

  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))
  // 沒有大綱的課連分頁都不顯示,不讓使用者點進去撲空。
  // 這一條只看 `syllabus_url`,不等大綱進度 —— 否則分頁會晚一拍才冒出來
  const showSyllabusTab = course.syllabus_url !== null
  const active = tab === 'syllabus' && showSyllabusTab ? 'syllabus' : 'info'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        to="/search"
        search={{ sem: semester }}
        className="text-muted-foreground text-sm underline underline-offset-4"
      >
        ← 回搜尋
      </Link>

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{course.name_zh}</h1>
          <ShareButton />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs tabular-nums">
            {course.id}
          </span>
          {course.requirement_type && <Badge>{course.requirement_type}</Badge>}
          {course.credits !== null && <Badge>{course.credits} 學分</Badge>}
          {course.hours !== null && <Badge>{course.hours} 小時</Badge>}
          {course.stage && <Badge>{course.stage} 年級</Badge>}
          {course.language !== null && course.language !== LANGUAGE_ZH && (
            <Badge>{course.language}</Badge>
          )}
        </div>
      </header>

      {/* 合開資訊在 notes 裡,是選課時真正會影響決定的資訊 —— 放在最上面 */}
      {course.notes && (
        <p className="bg-secondary/60 mt-4 rounded-lg px-3 py-2 text-sm">
          {course.notes}
        </p>
      )}

      <div className="mt-6 flex gap-1 border-b" role="tablist">
        <TabButton
          active={active === 'info'}
          onClick={() => void navigate({ search: {} })}
        >
          課程資訊
        </TabButton>
        {showSyllabusTab && (
          <TabButton
            active={active === 'syllabus'}
            onClick={() => void navigate({ search: { tab: 'syllabus' } })}
          >
            教學大綱
          </TabButton>
        )}
      </div>

      <div className="py-2">
        {active === 'info' ? (
          <CourseInfo
            course={course}
            semester={semester}
            meta={meta}
            deptName={deptName}
          />
        ) : (
          <SyllabusPanel
            state={state}
            syllabus={syllabus}
            syllabusUrl={course.syllabus_url}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-visible:ring-ring -mb-px border-b-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? 'border-primary font-medium'
          : 'text-muted-foreground border-transparent hover:border-current'
      }`}
    >
      {children}
    </button>
  )
}

function CourseInfo({
  course,
  semester,
  meta,
  deptName,
}: {
  course: Course
  semester: SemesterPath
  meta: Meta
  deptName: ReadonlyMap<string, string>
}) {
  const withdrawn = course.withdrawn ?? 0

  return (
    <dl>
      <Row label="時段">
        {course.time_slots.length === 0 ? (
          <span className="text-muted-foreground">無固定時段</span>
        ) : (
          <ul className="space-y-0.5">
            {course.time_slots.map((slot) => {
              const clock = formatSlotClock(slot, meta.periods)
              return (
                <li key={`${slot.day}-${slot.periods.join('')}`}>
                  {formatTimeSlots({ ...course, time_slots: [slot] }, meta.periods)}
                  {clock && (
                    <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                      {clock}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Row>

      <Row label="教師">
        {course.teachers.length === 0 ? (
          <span className="text-muted-foreground">未定</span>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {/* 教師專頁是 Phase 3。在那之前連到「以姓名搜尋」—— 那是一次搜尋,
                不宣稱同名的兩位老師是同一個人(plan §1.3.6) */}
            {course.teachers.map((name, i) => (
              <Link
                key={course.teacher_codes[i] ?? name}
                to="/search"
                search={{ sem: semester, q: name }}
                className="underline underline-offset-4"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </Row>

      <Row label="系所">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {course.department_ids.map((id) => (
            <Link
              key={id}
              to="/search"
              search={{ sem: semester, dept: [id] }}
              className="underline underline-offset-4"
            >
              {deptName.get(id) ?? id}
            </Link>
          ))}
        </div>
      </Row>

      {course.classes.length > 0 && <Row label="班級">{course.classes.join('、')}</Row>}

      {course.classrooms.length > 0 && (
        <Row label="教室">{course.classrooms.join('、')}</Row>
      )}

      <Row label="修課人數">
        {course.enrolled === null ? (
          <span className="text-muted-foreground">未提供</span>
        ) : (
          <span className="tabular-nums">
            {/* `enrolled` 是修課人數不是名額上限,文案不能寫「名額」 */}
            修課 {course.enrolled} 人
            {withdrawn > 0 && <span className="ml-2">撤選 {withdrawn} 人</span>}
          </span>
        )}
      </Row>

      {course.programs.length > 0 && (
        <Row label="學程">{course.programs.join('、')}</Row>
      )}

      {course.audit && <Row label="隨班附讀">{course.audit}</Row>}
      {course.lab && <Row label="實習">{course.lab}</Row>}
    </dl>
  )
}
