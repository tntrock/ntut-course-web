import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions } from '@/hooks/useSemesterIndex'
import { updateStore, useStore } from '@/hooks/useStore'
import {
  buildGrid,
  conflictingCourseIds,
  diffSnapshot,
  scheduleStats,
  visibleDays,
  type ScheduleChange,
} from '@/lib/schedule'
import { refreshSnapshot, removeFromSchedule } from '@/lib/storeActions'
import { formatTimeSlots } from '@/lib/formatTime'
import type { CourseIndexEntry, PeriodDef } from '@/types/api'
import type { SavedCourse } from '@/lib/storage'
import { Timetable } from '@/components/schedule/Timetable'
import { DataTransfer, Favorites } from '@/components/schedule/PersonalData'

interface ScheduleSearch {
  sem?: string
}

export const Route = createFileRoute('/schedule')({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch =>
    typeof search.sem === 'string' && search.sem !== '' ? { sem: search.sem } : {},

  /**
   * **只等 `meta`,不等學期索引。**
   *
   * 課表整張都畫得出來只靠 localStorage 裡的快照 —— 飛航模式重新整理也要看得到。
   * 索引是用來比對異動的,晚一點到就晚一點標,不該擋住渲染。
   */
  loader: ({ context }) => context.queryClient.ensureQueryData(metaQueryOptions()),
  component: SchedulePage,
})

function SchedulePage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()
  const store = useStore()

  const semester = params.sem ?? meta.latest
  const courses = store.schedules[semester]?.courses ?? []

  // 非 suspense:沒網路時這一支會失敗,課表照樣要畫出來
  const index = useQuery(semesterIndexQueryOptions(meta, semester))
  const latestById = index.data
    ? new Map(index.data.courses.map((c) => [c.id, c]))
    : null

  const grid = buildGrid(courses)
  const stats = scheduleStats(courses, meta.periods)
  const conflictIds = conflictingCourseIds(grid)
  const days = visibleDays(courses, store.settings.showWeekend)

  const changed = latestById
    ? courses
        .map((course) => ({
          course,
          changes: diffSnapshot(course.snapshot, latestById.get(course.id)),
          current: latestById.get(course.id),
        }))
        .filter((entry) => entry.changes.length > 0)
    : []

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">我的課表</h1>
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={store.settings.showWeekend}
              onChange={(e) =>
                updateStore((s) => ({
                  ...s,
                  settings: { ...s.settings, showWeekend: e.target.checked },
                }))
              }
            />
            週末
          </label>
          <select
            name="sem"
            value={semester}
            aria-label="學期"
            onChange={(e) => void navigate({ search: { sem: e.target.value } })}
            className="bg-card rounded-lg border px-2 py-1.5 text-sm"
          >
            {meta.semesters.map((s) => (
              <option key={s.path} value={s.path}>
                {s.path}
              </option>
            ))}
          </select>
        </div>
      </div>

      {courses.length === 0 ? (
        <Empty semester={semester} />
      ) : (
        <>
          {conflictIds.size > 0 && (
            <p className="bg-destructive/10 text-destructive mt-4 rounded-lg px-3 py-2 text-sm">
              {grid.conflicts.size} 處衝堂,涉及 {conflictIds.size} 門課。
              {/* 加課時不阻擋,只在這裡警告 —— 使用者可能正在比較兩個方案 */}
              課表不會擋你加課,自己確認一下。
            </p>
          )}

          {changed.length > 0 && (
            <ChangeList entries={changed} semester={semester} periods={meta.periods} />
          )}

          {index.isError && (
            <p className="bg-secondary text-muted-foreground mt-4 rounded-lg px-3 py-2 text-sm">
              連不上資料來源,以下是上次儲存的課表。異動偵測暫時停用。
            </p>
          )}

          <div className="mt-5">
            <Timetable
              courses={courses}
              periods={meta.periods}
              semester={semester}
              days={days}
              conflictIds={conflictIds}
            />
          </div>

          {grid.unscheduled.length > 0 && (
            <section className="mt-6">
              <h2 className="text-muted-foreground text-xs font-medium">未排入時段</h2>
              {/* 體育、班週會這類沒有固定時段。不列出來使用者會以為課掉了 */}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {grid.unscheduled.map((course) => (
                  <SavedCourseRow
                    key={course.id}
                    course={course}
                    semester={semester}
                    periods={meta.periods}
                    conflicted={false}
                  />
                ))}
              </div>
            </section>
          )}

          <Stats stats={stats} />

          <section className="mt-6">
            <h2 className="text-muted-foreground text-xs font-medium">
              全部 {courses.length} 門
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {courses.map((course) => (
                <SavedCourseRow
                  key={course.id}
                  course={course}
                  semester={semester}
                  periods={meta.periods}
                  conflicted={conflictIds.has(course.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <Favorites meta={meta} semester={semester} courses={latestById} />
      <DataTransfer />
    </div>
  )
}

function Empty({ semester }: { semester: string }) {
  return (
    <div className="bg-card shadow-card mt-6 rounded-xl px-4 py-16 text-center">
      <p className="font-medium">{semester} 的課表還是空的</p>
      <p className="text-muted-foreground mt-2 text-sm">
        在搜尋結果或課程頁按「加入課表」就會出現在這裡。
      </p>
      <Link
        to="/search"
        search={{ sem: semester }}
        className="bg-primary text-primary-foreground mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium"
      >
        去找課
      </Link>
    </div>
  )
}

function SavedCourseRow({
  course,
  semester,
  periods,
  conflicted,
}: {
  course: SavedCourse
  semester: string
  periods: readonly PeriodDef[]
  conflicted: boolean
}) {
  return (
    <div
      className={`bg-card shadow-card flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        conflicted ? 'ring-destructive/40 ring-1' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <Link
          to="/course/$semester/$courseId"
          params={{ semester, courseId: course.id }}
          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
        >
          {course.snapshot.name_zh}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {course.snapshot.teachers.join('、') || '未定'}
          <span className="mx-1.5">·</span>
          {formatTimeSlots(course.snapshot, periods)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => updateStore((s) => removeFromSchedule(s, semester, course.id))}
        aria-label={`從課表移除 ${course.snapshot.name_zh}`}
        className="text-muted-foreground hover:bg-accent focus-visible:ring-ring shrink-0 rounded-lg px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        移除
      </button>
    </div>
  )
}

interface ChangedEntry {
  course: SavedCourse
  changes: ScheduleChange[]
  current: CourseIndexEntry | undefined
}

function describe(change: ScheduleChange): string {
  switch (change.kind) {
    case 'removed':
      return '此課已停開'
    case 'time':
      return '時段已異動'
    case 'teachers':
      return '授課教師已更換'
    case 'credits':
      return `學分數已異動 ${change.from ?? '—'} → ${change.to ?? '—'}`
  }
}

/**
 * 把 crawler 的異動偵測接到使用者最在乎的地方:他自己那幾門課。
 *
 * 停開的課**留在課表裡但標紅**,不自動移除 —— 替使用者做決定會讓他不知道
 * 自己原本選了什麼。
 */
function ChangeList({
  entries,
  semester,
  periods,
}: {
  entries: ChangedEntry[]
  semester: string
  /** 判斷節次相不相鄰一定要用 meta 的順序,不然 `7、8` 會被寫成兩段。 */
  periods: readonly PeriodDef[]
}) {
  return (
    <section className="border-warning bg-warning/10 mt-4 rounded-lg border-l-2 px-3 py-2.5">
      <h2 className="text-sm font-medium">{entries.length} 門課有異動</h2>
      <ul className="mt-2 space-y-2">
        {entries.map(({ course, changes, current }) => (
          <li key={course.id} className="text-sm">
            <Link
              to="/course/$semester/$courseId"
              params={{ semester, courseId: course.id }}
              className="font-medium underline underline-offset-4"
            >
              {course.snapshot.name_zh}
            </Link>
            <span className="text-muted-foreground ml-2 text-xs">
              {changes.map(describe).join('、')}
            </span>

            {changes.map((change) =>
              change.kind === 'time' ? (
                <p key="time" className="text-muted-foreground mt-0.5 text-xs">
                  {formatTimeSlots({ time_slots: change.from }, periods)}
                  <span className="mx-1.5">→</span>
                  {formatTimeSlots({ time_slots: change.to }, periods)}
                </p>
              ) : null,
            )}

            {current && (
              <button
                type="button"
                onClick={() =>
                  updateStore((s) => refreshSnapshot(s, semester, course.id, current))
                }
                className="text-primary hover:bg-accent mt-1 rounded-md px-2 py-0.5 text-xs"
              >
                更新為最新資料
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stats({ stats }: { stats: ReturnType<typeof scheduleStats> }) {
  return (
    <section className="mt-6">
      <h2 className="text-muted-foreground text-xs font-medium">統計</h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="總學分" value={String(stats.totalCredits)} />
        <Stat label="必修" value={String(stats.requiredCredits)} />
        <Stat label="選修" value={String(stats.electiveCredits)} />
        <Stat label="門數" value={String(stats.courseCount)} />
      </dl>

      {/* 這兩種課會讓總學分看起來不對,不講清楚使用者會以為程式壞了 */}
      {stats.unclassifiedCredits > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          另有 {stats.unclassifiedCredits} 學分的課沒有標示必選修,未計入上面兩欄。
        </p>
      )}
      {stats.unknownCreditCount > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          {stats.unknownCreditCount} 門課沒有提供學分數,未計入總學分。
        </p>
      )}
      {stats.earliest && stats.latest && (
        <p className="text-muted-foreground mt-1 text-xs">
          最早第 {stats.earliest} 節,最晚第 {stats.latest} 節。
        </p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card shadow-card rounded-xl p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-xl font-medium tabular-nums">{value}</dd>
    </div>
  )
}
