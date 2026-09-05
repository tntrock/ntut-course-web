import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import {
  classroomsQueryOptions,
  programsQueryOptions,
  teachersQueryOptions,
} from '@/hooks/useBrowse'
import { useDebounced } from '@/hooks/useDebounced'
import {
  collegeGroups,
  filterByName,
  groupByInitial,
  isCollegeWideUnit,
} from '@/lib/browse'
import type { Classroom, Department, Meta, Program, TeacherSummary } from '@/types/api'

const TABS = ['dept', 'teacher', 'program', 'classroom'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  dept: '系所',
  teacher: '教師',
  program: '學程',
  classroom: '教室',
}

interface BrowseSearch {
  sem?: string
  tab?: Tab
  q?: string
}

function isTab(value: unknown): value is Tab {
  return TABS.includes(value as Tab)
}

export const Route = createFileRoute('/browse')({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const out: BrowseSearch = {}
    if (typeof search.sem === 'string' && search.sem !== '') out.sem = search.sem
    if (isTab(search.tab)) out.tab = search.tab
    if (typeof search.q === 'string' && search.q !== '') out.q = search.q
    return out
  },

  // 關鍵字只在前端過濾,不該觸發重新載入
  loaderDeps: ({ search }) => ({ sem: search.sem, tab: search.tab }),

  /**
   * **只載入目前分頁要用的清單。** 四份加起來 34 KB(gzip)不算多,但沒必要為了
   * 看系所而下載 234 間教室。
   *
   * `departments.json` 是例外 —— 系所分頁要它,教師分頁也要它把系所代碼換成中文名。
   */
  loader: async ({ context, deps }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    const semester = deps.sem ?? meta.latest
    const tab = deps.tab ?? 'dept'

    // 每個分支各自呼叫 —— 把不同回應型別的 queryOptions 收成一個變數再傳,
    // 會讓 TypeScript 把它們併成聯集而對不上 ensureQueryData 的型別
    const extra = async (): Promise<unknown> => {
      const qc = context.queryClient
      if (tab === 'teacher')
        return qc.ensureQueryData(teachersQueryOptions(meta, semester))
      if (tab === 'program')
        return qc.ensureQueryData(programsQueryOptions(meta, semester))
      if (tab === 'classroom')
        return qc.ensureQueryData(classroomsQueryOptions(meta, semester))
      return null
    }

    await Promise.all([
      context.queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
      extra(),
    ])
  },

  component: BrowsePage,
})

function BrowsePage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()

  const semester = params.sem ?? meta.latest
  const tab: Tab = params.tab ?? 'dept'

  // 與搜尋頁同樣的做法:輸入框自己維持狀態,debounce 之後才寫回網址,
  // 否則上一頁會變成一個字一個字倒退
  const [draft, setDraft] = useState(params.q ?? '')
  const [lastQ, setLastQ] = useState(params.q)
  if (params.q !== lastQ) {
    setLastQ(params.q)
    setDraft(params.q ?? '')
  }
  const query = useDebounced(draft)

  // `q: undefined` 是「把關鍵字清掉」的意思,所以型別要明確容得下 undefined
  // (exactOptionalPropertyTypes 下 `Partial<T>` 不接受顯式的 undefined)
  const setSearch = (patch: { sem?: string; tab?: Tab; q?: string | undefined }) => {
    void navigate({
      search: (prev: BrowseSearch) => {
        const merged: Record<string, unknown> = { ...prev, ...patch }
        for (const key of ['sem', 'tab', 'q'] as const) {
          if (merged[key] === undefined || merged[key] === '') delete merged[key]
        }
        return merged as BrowseSearch
      },
      replace: patch.q !== undefined,
    })
  }

  // 導頁是副作用,不能在 render 期做
  useEffect(() => {
    if (query === (params.q ?? '')) return
    setSearch({ q: query })
    // setSearch 每次 render 都是新的函式,放進相依陣列會變成無窮迴圈
    // oxlint-disable-next-line exhaustive-deps
  }, [query, params.q])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">瀏覽</h1>
        <select
          name="sem"
          value={semester}
          aria-label="學期"
          onChange={(e) => setSearch({ sem: e.target.value })}
          className="bg-card rounded-lg border px-2 py-1 text-sm"
        >
          {meta.semesters.map((s) => (
            <option key={s.path} value={s.path}>
              {s.path}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex gap-1 border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setSearch({ tab: t, q: undefined })}
            className={`focus-visible:ring-ring -mb-px border-b-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none ${
              tab === t
                ? 'border-primary font-medium'
                : 'text-muted-foreground border-transparent hover:border-current'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <input
        type="search"
        name="q"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`搜尋${TAB_LABELS[tab]}`}
        aria-label={`搜尋${TAB_LABELS[tab]}`}
        className="bg-background focus-visible:ring-ring mt-4 w-full rounded-lg border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="mt-4">
        {tab === 'dept' && <DeptTab meta={meta} semester={semester} query={query} />}
        {tab === 'teacher' && (
          <TeacherTab meta={meta} semester={semester} query={query} />
        )}
        {tab === 'program' && (
          <ProgramTab meta={meta} semester={semester} query={query} />
        )}
        {tab === 'classroom' && (
          <ClassroomTab meta={meta} semester={semester} query={query} />
        )}
      </div>
    </div>
  )
}

function Empty({ what }: { what: string }) {
  return (
    <p className="text-muted-foreground px-4 py-16 text-center text-sm">
      沒有符合的{what}。
    </p>
  )
}

/** 一列可點的項目:名稱 + 右側計數。四個分頁共用。 */
function Count({ n }: { n: number }) {
  return (
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{n} 門</span>
  )
}

interface TabProps {
  meta: Meta
  semester: string
  query: string
}

function DeptTab({ meta, semester, query }: TabProps) {
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const groups = collegeGroups(departments)

  const filtered = groups
    .map((g) => ({
      ...g,
      departments: filterByName(g.departments, (d) => d.name, query),
    }))
    .filter((g) => g.departments.length > 0)

  if (filtered.length === 0) return <Empty what="系所" />

  return (
    <div className="space-y-6">
      {filtered.map((group) => (
        <section key={group.name}>
          <h2 className="text-muted-foreground mb-1 text-xs font-medium">
            {group.name}
          </h2>
          {/* 60 個系所排成一長條要捲很久。寬螢幕分兩欄,一眼看得完一個學院 */}
          <div className="grid gap-2 sm:grid-cols-2">
            {group.departments.map((d) => (
              <DeptRow key={d.id} dept={d} semester={semester} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function DeptRow({ dept, semester }: { dept: Department; semester: string }) {
  return (
    <div className="bg-card shadow-card rounded-xl px-3 py-1">
      <div className="flex items-center gap-3 py-2">
        <Link
          to="/dept/$semester/$deptId"
          params={{ semester, deptId: dept.id }}
          className="flex-1 text-sm underline-offset-4 hover:underline"
        >
          {dept.name}
          {/* C0/C2/C5/C7 掛的是院級共同課程,名字又和上層學院一模一樣。
              不標的話沒有人分得出這是「電資學院的共同課」還是「電資學院所有系」 */}
          {isCollegeWideUnit(dept) && (
            <span className="text-muted-foreground ml-2 text-xs">院級共同課程</span>
          )}
        </Link>
        <Count n={dept.course_count} />
      </div>

      {dept.class_groups.length > 0 && (
        <details className="pb-2">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {dept.class_groups.length} 個班級
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1">
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
        </details>
      )}
    </div>
  )
}

function TeacherTab({ meta, semester, query }: TabProps) {
  const teachers = useSuspenseQuery(teachersQueryOptions(meta, semester)).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))

  const matched = filterByName(teachers.teachers, (t) => t.name, query)
  if (matched.length === 0) return <Empty what="教師" />

  const groups = groupByInitial(matched, (t) => t.name)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.initial}>
          <h2 className="text-muted-foreground mb-1 text-xs font-medium">
            {group.initial}
          </h2>
          <div className="bg-card shadow-card grid rounded-xl px-3 sm:grid-cols-2 sm:gap-x-4">
            {group.items.map((t) => (
              <TeacherRow
                key={t.id}
                teacher={t}
                semester={semester}
                deptName={deptName}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TeacherRow({
  teacher,
  semester,
  deptName,
}: {
  teacher: TeacherSummary
  semester: string
  deptName: ReadonlyMap<string, string>
}) {
  const depts = teacher.department_ids.map((id) => deptName.get(id) ?? id).join('、')

  return (
    <Link
      to="/teacher/$semester/$teacherId"
      params={{ semester, teacherId: teacher.id }}
      className="hover:bg-muted/40 flex items-center gap-3 border-b px-1 py-2.5"
    >
      <span className="text-sm">{teacher.name}</span>
      {/* 同名老師有兩位(林志哲、陳盈竹)。所屬系所是畫面上唯一分得出誰是誰的線索 */}
      <span className="text-muted-foreground flex-1 truncate text-xs">{depts}</span>
      <Count n={teacher.course_count} />
    </Link>
  )
}

function ProgramTab({ meta, semester, query }: TabProps) {
  const programs = useSuspenseQuery(programsQueryOptions(meta, semester)).data
  const matched = filterByName(programs.programs, (p) => p.name, query)

  if (matched.length === 0) return <Empty what="學程" />

  return (
    <div className="bg-card shadow-card grid rounded-xl px-3 sm:grid-cols-2 sm:gap-x-4">
      {matched.map((p: Program) => (
        <Link
          key={p.name}
          to="/program/$semester/$programName"
          params={{ semester, programName: p.name }}
          className="hover:bg-muted/40 flex items-center gap-3 border-b px-1 py-2.5"
        >
          <span className="flex-1 text-sm">{p.name}</span>
          <Count n={p.course_count} />
        </Link>
      ))}
    </div>
  )
}

function ClassroomTab({ meta, semester, query }: TabProps) {
  const classrooms = useSuspenseQuery(classroomsQueryOptions(meta, semester)).data
  const matched = filterByName(classrooms.classrooms, (c) => c.name, query)

  if (matched.length === 0) return <Empty what="教室" />

  return (
    <div className="bg-card shadow-card grid rounded-xl px-3 sm:grid-cols-2 sm:gap-x-4">
      {matched.map((c: Classroom) => (
        <Link
          key={c.id}
          to="/classroom/$semester/$classroomId"
          params={{ semester, classroomId: c.id }}
          className="hover:bg-muted/40 flex items-center gap-3 border-b px-1 py-2.5"
        >
          <span className="flex-1 text-sm">{c.name}</span>
          <Count n={c.course_count} />
        </Link>
      ))}
    </div>
  )
}
