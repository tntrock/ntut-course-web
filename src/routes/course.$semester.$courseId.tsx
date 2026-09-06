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
import { stageBadge } from '@/lib/course'
import { CourseInfo } from '@/components/course/CourseInfo'
import { confirmedSyllabusVersion, syllabusState } from '@/lib/syllabus'
import { LANGUAGE_ZH } from '@/lib/filters'
import { BackLink } from '@/components/BackLink'
import { Badge } from '@/components/ui/Badge'
import { ScheduleToggle } from '@/components/ScheduleToggle'
import { FavoriteToggle } from '@/components/FavoriteToggle'
import { SyllabusPanel } from '@/components/course/SyllabusPanel'

interface DetailSearch {
  tab?: 'syllabus'
}

export const Route = createFileRoute('/course/$semester/$courseId')({
  validateSearch: (search: Record<string, unknown>): DetailSearch =>
    search.tab === 'syllabus' ? { tab: 'syllabus' } : {},

  /**
   * 冷啟動(直接開分享連結)的請求安排。實測線上冷快取約 1.25 秒,
   * 其中三個來回就佔了約 700ms —— 這是「沒有 lookup.json」的固有成本
   * (要拿系所代碼就得先載整份索引)。這裡榨乾的是排程:
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
        const version = confirmedSyllabusVersion(progress, semester, courseId)
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
        {/* 課號跨學期不穩定—— 這是最常見的原因，直接講出來 */}
        課號在不同學期並不通用，舊連結換到別的學期通常就查不到了。
      </p>
      <Link to="/search" className="mt-6 inline-block text-sm underline">
        回搜尋
      </Link>
    </div>
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
  const stage = stageBadge(course.stage)
  const showSyllabusTab = course.syllabus_url !== null
  const active = tab === 'syllabus' && showSyllabusTab ? 'syllabus' : 'info'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* 這一頁可能從搜尋、系所、教師、教室、學程任何一處進來 */}
      <BackLink
        fallback={
          <Link
            to="/search"
            search={{ sem: semester }}
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            ← 回搜尋
          </Link>
        }
      />

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{course.name_zh}</h1>
          <div className="flex shrink-0 items-start gap-2">
            <FavoriteToggle semester={semester} courseId={course.id} />
            <ShareButton />
          </div>
        </div>
        <div className="mt-3">
          <ScheduleToggle course={course} semester={semester} variant="button" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/*
            **學期一定要看得見。** 分享連結進來的人不知道自己看的是哪一學期，
            而課號跨學期不通用—— 沒有這個標示，一門 114-2 的課
            看起來會跟本學期的課一模一樣。
          */}
          <span className="text-muted-foreground text-xs tabular-nums">
            {semester}
            <span className="mx-1.5">·</span>
            {course.id}
          </span>
          {course.requirement_type && (
            <Badge tone={course.required === true ? 'strong' : 'normal'}>
              {course.requirement_type}
            </Badge>
          )}
          {course.language !== null && course.language !== LANGUAGE_ZH && (
            <Badge>{course.language}</Badge>
          )}
          {course.credits !== null && <Badge tone="quiet">{course.credits} 學分</Badge>}
          {course.hours !== null && <Badge tone="quiet">{course.hours} 小時</Badge>}
          {stage && <Badge tone="quiet">{stage}</Badge>}
        </div>
      </header>

      {/* 合開資訊在 notes 裡，是選課時真正會影響決定的資訊 —— 放在最上面。
          標上「備註」才知道這是學校寫的，不是本站的提示 */}
      {course.notes && (
        <div className="border-primary bg-primary-muted/40 mt-4 rounded-lg border-l-2 px-3 py-2">
          <p className="text-muted-foreground text-xs">備註</p>
          <p className="mt-0.5 text-sm">{course.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-1 border-b" role="tablist" aria-label="課程分頁">
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

      {/* 內容放在卡片上，和頁面底色分層 —— 只靠 1px 分隔線的話
          看起來像沒排版的表格 */}
      <div className="bg-card shadow-card mt-3 rounded-xl px-4 py-1">
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
