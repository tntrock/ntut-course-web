import { useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { useClassroomBackfill } from '@/hooks/useClassroomBackfill'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions } from '@/hooks/useSemesterIndex'
import { updateStore, useStore } from '@/hooks/useStore'
import {
  buildGrid,
  conflictingCourseIds,
  diffSnapshot,
  scheduleStats,
  visibleDays,
} from '@/lib/schedule'
import { ExportButton } from '@/components/schedule/ExportButton'
import { ChangeList } from '@/components/schedule/ChangeList'
import { SavedCourseRow } from '@/components/schedule/SavedCourseRow'
import { ScheduleStats } from '@/components/schedule/ScheduleStats'
import { Timetable } from '@/components/schedule/Timetable'
import { ExportImage } from '@/components/schedule/ExportImage'
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

  // 搜尋結果加入的課沒有教室(輕量索引沒有這個欄位),回頭補起來
  useClassroomBackfill(meta, semester)

  // 非 suspense:沒網路時這一支會失敗,課表照樣要畫出來
  const index = useQuery(semesterIndexQueryOptions(meta, semester))
  const latestById = index.data
    ? new Map(index.data.courses.map((c) => [c.id, c]))
    : null

  const grid = buildGrid(courses)
  const stats = scheduleStats(courses, meta.periods)
  const conflictIds = conflictingCourseIds(grid)
  const days = visibleDays(courses, store.settings.showWeekend)

  const exportRef = useRef<HTMLDivElement>(null)

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
          {courses.length > 0 && (
            <ExportButton targetRef={exportRef} semester={semester} />
          )}
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
              {grid.conflicts.size} 處衝堂，涉及 {conflictIds.size} 門課。
              {/* 加課時不阻擋，只在這裡警告 —— 使用者可能正在比較兩個方案 */}
              這裡只提醒，不會擋你加課 —— 請自己確認實際上課時間。
            </p>
          )}

          {changed.length > 0 && (
            <ChangeList entries={changed} semester={semester} periods={meta.periods} />
          )}

          {index.isError && (
            <p className="bg-secondary text-muted-foreground mt-4 rounded-lg px-3 py-2 text-sm">
              連不上資料來源，以下是上次儲存的課表。異動偵測暫時停用。
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

          <ScheduleStats stats={stats} />

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

      {/*
        匯出用的離屏版面。**不能用 `display: none`** —— 截圖需要真實的版面尺寸，
        沒有佈局就量不到東西。移到畫面外並對輔助技術隱藏。
      */}
      {courses.length > 0 && (
        <div
          aria-hidden
          style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}
        >
          <div ref={exportRef}>
            <ExportImage
              courses={courses}
              periods={meta.periods}
              semester={semester}
              showWeekend={store.settings.showWeekend}
              conflictIds={conflictIds}
            />
          </div>
        </div>
      )}
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
