import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { teachersQueryOptions } from '@/hooks/useBrowse'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions } from '@/hooks/useSemesterIndex'
import {
  courseWithdrawals,
  teacherWithdrawals,
  type CourseWithdrawal,
  type TeacherWithdrawal,
} from '@/lib/withdrawal'
import type { SemesterPath } from '@/types/api'

const TABS = ['teacher', 'course'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { teacher: '教師', course: '課程' }

/** 最少原始修課人次。小樣本不擋的話榜首永遠是「3 人修、2 人撤」。 */
const MIN_OPTIONS = [0, 30, 50, 100] as const
const DEFAULT_MIN = 50

interface WithdrawalSearch {
  sem?: string
  tab?: Tab
  min?: number
}

export const Route = createFileRoute('/withdrawal')({
  validateSearch: (search: Record<string, unknown>): WithdrawalSearch => {
    const out: WithdrawalSearch = {}
    if (typeof search.sem === 'string' && search.sem !== '') out.sem = search.sem
    if (TABS.includes(search.tab as Tab)) out.tab = search.tab as Tab
    const min = Number(search.min)
    if (Number.isFinite(min) && min >= 0) out.min = min
    return out
  },

  loaderDeps: ({ search }) => ({ sem: search.sem }),

  loader: async ({ context, deps }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    const semester = deps.sem ?? meta.latest
    await Promise.all([
      context.queryClient.ensureQueryData(semesterIndexQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(teachersQueryOptions(meta, semester)),
    ])
  },

  component: WithdrawalPage,
})

function WithdrawalPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()

  const semester: SemesterPath = params.sem ?? meta.latest
  const tab = params.tab ?? 'teacher'
  const min = params.min ?? DEFAULT_MIN

  const index = useSuspenseQuery(semesterIndexQueryOptions(meta, semester)).data
  const teachers = useSuspenseQuery(teachersQueryOptions(meta, semester)).data
  const names = new Map(teachers.teachers.map((t) => [t.id, t.name]))

  // 學期還沒開始時撤選全是 0,直接給一個跳到上一學期的捷徑比叫人自己找下拉選單好
  const previous =
    meta.semesters[meta.semesters.findIndex((s) => s.path === semester) + 1]?.path

  const totalWithdrawn = index.courses.reduce((n, c) => n + (c.withdrawn ?? 0), 0)
  const totalEnrolled = index.courses.reduce((n, c) => n + (c.enrolled ?? 0), 0)

  const rows =
    tab === 'teacher'
      ? teacherWithdrawals(index.courses, names, min)
      : courseWithdrawals(index.courses, min)

  const set = (patch: Partial<WithdrawalSearch>) => {
    void navigate({
      search: (prev: WithdrawalSearch) => ({ ...prev, ...patch }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">退選率</h1>
        <select
          name="sem"
          value={semester}
          aria-label="學期"
          onChange={(e) => set({ sem: e.target.value })}
          className="bg-card rounded-lg border px-2 py-1 text-sm"
        >
          {meta.semesters.map((s) => (
            <option key={s.path} value={s.path}>
              {s.path}
            </option>
          ))}
        </select>
      </div>

      {/* 這段不是客套話。不寫的話這頁會被直接讀成老師的評價排行 */}
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        退選率 = 撤選人數 ÷（目前選課人數 + 撤選人數）。
        <strong className="text-foreground">高不代表老師教得差</strong>
        ——
        可能是擋修的必修、時段不好、或課本身就難。比率旁邊一律附上原始人次，請一起看。
      </p>

      {totalWithdrawn === 0 ? (
        <p className="bg-secondary text-foreground mt-4 rounded-lg px-4 py-3 text-sm">
          {semester} 還沒有任何撤選紀錄 —— 撤選期通常在學期開始幾週後。
          {previous !== undefined && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => set({ sem: previous })}
                className="underline underline-offset-4"
              >
                改看 {previous}
              </button>
            </>
          )}
        </p>
      ) : (
        <p className="bg-secondary/60 text-foreground mt-4 rounded-lg px-4 py-3 text-sm">
          {semester} 全校撤選 {totalWithdrawn.toLocaleString('zh-Hant')} 人次，原始修課{' '}
          {(totalEnrolled + totalWithdrawn).toLocaleString('zh-Hant')} 人次，整體{' '}
          {((totalWithdrawn / (totalEnrolled + totalWithdrawn)) * 100).toFixed(2)}%。
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => set({ tab: t })}
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

        <label className="text-muted-foreground pb-1.5 text-xs">
          最少人次{' '}
          <select
            value={min}
            onChange={(e) => set({ min: Number(e.target.value) })}
            className="bg-card text-foreground rounded border px-1.5 py-1 text-xs"
          >
            {MIN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? '不限' : `${n} 人`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground bg-card shadow-card mt-4 rounded-xl px-4 py-16 text-center text-sm">
          {totalWithdrawn === 0 ? '這個學期沒有撤選紀錄。' : '沒有符合門檻的資料。'}
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((row, i) => (
            <li key={'code' in row ? row.code : row.id}>
              <Row row={row} rank={i + 1} semester={semester} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Row({
  row,
  rank,
  semester,
}: {
  row: TeacherWithdrawal | CourseWithdrawal
  rank: number
  semester: SemesterPath
}) {
  const isTeacher = 'code' in row
  const pct = (row.rate * 100).toFixed(1)

  const body = (
    <>
      <span className="text-muted-foreground w-7 shrink-0 text-right text-xs tabular-nums">
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{row.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {isTeacher
            ? `${row.courseCount} 門課`
            : row.teachers.length > 0
              ? row.teachers.join('、')
              : '未定'}
        </span>
      </span>
      {/* 比率與原始人次一定要並排 —— 只給比率就是在鼓勵誤讀 */}
      <span className="shrink-0 text-right">
        <span className="block text-sm font-medium tabular-nums">{pct}%</span>
        <span className="text-muted-foreground block text-xs tabular-nums">
          撤 {row.withdrawn} / {row.base} 人
        </span>
      </span>
    </>
  )

  const className =
    'bg-card shadow-card hover:bg-accent flex items-center gap-3 rounded-xl px-3 py-2.5'

  return isTeacher ? (
    <Link
      to="/teacher/$semester/$teacherId"
      params={{ semester, teacherId: row.code }}
      className={className}
    >
      {body}
    </Link>
  ) : (
    <Link
      to="/course/$semester/$courseId"
      params={{ semester, courseId: row.id }}
      className={className}
    >
      {body}
    </Link>
  )
}
