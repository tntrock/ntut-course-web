import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Controls } from '@/components/withdrawal/Controls'
import { RankRow } from '@/components/withdrawal/RankRow'
import { StatsBar } from '@/components/withdrawal/StatsBar'
import { useDebounced } from '@/hooks/useDebounced'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import {
  RANGES,
  rangeSemesters,
  useWithdrawalRange,
  type Range,
} from '@/hooks/useWithdrawal'
import {
  courseRows,
  GROUPINGS,
  matchRow,
  rateGroups,
  sortRows,
  SORTS,
  teacherRows,
  withdrawalStats,
  type Grouping,
  type Sort,
} from '@/lib/withdrawal'
import type { SemesterPath } from '@/types/api'

const TABS = ['teacher', 'course'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { teacher: '教師', course: '課程' }
const UNITS: Record<Tab, string> = { teacher: '位教師', course: '門課' }

const DEFAULT_MIN = 50
/** 115-1 的撤選期還沒到（「撤」全是 0），預設看單一學期只會是空的。 */
const DEFAULT_RANGE: Range = 'y3'
/** 一次畫幾列。890 位老師全部塞進 DOM 會讓捲動掉幀。 */
const PAGE = 100

interface WithdrawalSearch {
  sem?: string
  tab?: Tab
  min?: number
  range?: Range
  sort?: Sort
  group?: Grouping
  q?: string
}

export const Route = createFileRoute('/withdrawal')({
  validateSearch: (search: Record<string, unknown>): WithdrawalSearch => {
    const out: WithdrawalSearch = {}
    if (typeof search.sem === 'string' && search.sem !== '') out.sem = search.sem
    if (TABS.includes(search.tab as Tab)) out.tab = search.tab as Tab
    if (RANGES.includes(search.range as Range)) out.range = search.range as Range
    if (SORTS.includes(search.sort as Sort)) out.sort = search.sort as Sort
    if (GROUPINGS.includes(search.group as Grouping))
      out.group = search.group as Grouping
    if (typeof search.q === 'string' && search.q !== '') out.q = search.q
    const min = Number(search.min)
    if (Number.isFinite(min) && min >= 0) out.min = min
    return out
  },

  // 學期資料交給 useQueries 逐一載入 —— 「所有期間」是 51 支請求,
  // 全部塞進 loader 會讓整頁卡在白畫面好幾秒
  loader: ({ context }) => context.queryClient.ensureQueryData(metaQueryOptions()),

  component: WithdrawalPage,
})

function WithdrawalPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()
  const [limit, setLimit] = useState(PAGE)

  const semester: SemesterPath = params.sem ?? meta.latest
  const tab = params.tab ?? 'teacher'
  const min = params.min ?? DEFAULT_MIN
  const range = params.range ?? DEFAULT_RANGE
  const sort = params.sort ?? 'rate-desc'
  const grouping = params.group ?? 'rate'

  // 與搜尋頁、瀏覽頁一樣:輸入框自己維持狀態,debounce 之後才寫回網址,
  // 否則上一頁會變成一個字一個字倒退
  const [draft, setDraft] = useState(params.q ?? '')
  const [lastQ, setLastQ] = useState(params.q)
  if (params.q !== lastQ) {
    setLastQ(params.q)
    setDraft(params.q ?? '')
  }
  const q = useDebounced(draft)

  const semesters = rangeSemesters(meta, semester, range)
  const { merged, loaded, total, pending, error } = useWithdrawalRange(meta, semesters)

  const all = useMemo(
    () => (tab === 'teacher' ? teacherRows(merged, min) : courseRows(merged, min)),
    [merged, tab, min],
  )

  // 基準線用門檻篩過、但**沒有**套搜尋的資料算 —— 搜尋一個名字就讓全校平均
  // 跟著跳動的話,那個數字就不再是基準線了
  const stats = useMemo(() => withdrawalStats(all.map((r) => r.rate)), [all])

  const filtered = useMemo(
    () =>
      sortRows(
        all.filter((r) => matchRow(r, q)),
        sort,
      ),
    [all, q, sort],
  )

  // **分組要用完整的清單算,不是這一頁。** 只算這一頁的話,「明顯偏高 78 位」
  // 講的其實是「前 100 名裡有 78 位」—— 換個排序就變成假的。
  // 算完再逐組取到湊滿 limit
  const grouped =
    grouping === 'rate'
      ? rateGroups(filtered, stats)
      : [{ label: '', hint: '', rows: filtered }]

  const groups = grouped
    .map((g, i) => {
      const before = grouped.slice(0, i).reduce((n, x) => n + x.rows.length, 0)
      const take = Math.max(0, Math.min(limit - before, g.rows.length))
      return { ...g, total: g.rows.length, rows: g.rows.slice(0, take) }
    })
    .filter((g) => g.rows.length > 0)

  // 照姓名排的「第 3 名」沒有意義,只有依退選率排序時才給名次
  const ranks = sort === 'rate-desc'
  const rankOf = new Map(filtered.map((r, i) => [r.key + (r.semester ?? ''), i + 1]))

  const set = (patch: Partial<WithdrawalSearch>) => {
    // 換分頁 / 期間 / 門檻之後還停在第 500 名很奇怪,回到第一頁
    setLimit(PAGE)
    void navigate({ search: (prev: WithdrawalSearch) => ({ ...prev, ...patch }) })
  }

  // 導頁是副作用,不能在 render 期做。這裡直接呼叫 navigate 而不是走 `set`,
  // 因為 `set` 會順手重設 limit —— 在 effect 裡 setState 會多跑一輪 render
  useEffect(() => {
    if (q === (params.q ?? '')) return
    void navigate({
      search: (prev: WithdrawalSearch) => {
        const merged: Record<string, unknown> = { ...prev, q }
        if (q === '') delete merged.q
        return merged as WithdrawalSearch
      },
      replace: true,
    })
    // navigate 每次 render 都是新的函式,放進相依陣列會變成無窮迴圈
    // oxlint-disable-next-line exhaustive-deps
  }, [q, params.q])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">退選率</h1>
        <select
          name="sem"
          value={semester}
          aria-label="起始學期"
          onChange={(e) => set({ sem: e.target.value })}
          className="bg-card border-input rounded-lg border px-2 py-1 text-sm"
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

      <StatsBar
        stats={stats}
        enrolled={merged.enrolled}
        withdrawn={merged.withdrawn}
        semesters={merged.semesters}
        unit={UNITS[tab]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-1 border-b" role="tablist">
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

      <Controls
        range={range}
        sort={sort}
        grouping={grouping}
        min={min}
        query={draft}
        unit={UNITS[tab]}
        onChange={set}
        onQuery={setDraft}
      />

      <Notes
        pending={pending}
        loaded={loaded}
        total={total}
        range={range}
        skipped={merged.skipped}
        error={error}
        withdrawn={merged.withdrawn}
        onRange={(range) => set({ range })}
      />

      {filtered.length > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">
          已顯示 {Math.min(limit, filtered.length).toLocaleString('zh-Hant')} /{' '}
          {filtered.length.toLocaleString('zh-Hant')} {UNITS[tab]}
        </p>
      )}

      {filtered.length === 0 && !pending ? (
        // 完全沒有撤選紀錄時上面那條提示已經講過了,這裡再講一次是重複
        merged.withdrawn === 0 ? null : (
          <p className="text-muted-foreground bg-card shadow-card mt-4 rounded-xl px-4 py-16 text-center text-sm">
            沒有符合條件的資料。試著放寬門檻或換個關鍵字。
          </p>
        )
      ) : (
        <div className="mt-2 space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              {group.label !== '' && (
                <h2 className="text-muted-foreground mb-1.5 flex items-baseline gap-2 text-xs font-medium">
                  {group.label}
                  <span className="font-normal tabular-nums">{group.hint}</span>
                  <span className="ml-auto tabular-nums">
                    {group.total} {UNITS[tab]}
                  </span>
                </h2>
              )}
              <ol className="space-y-1.5">
                {group.rows.map((row) => (
                  <li key={row.key + (row.semester ?? '')}>
                    <RankRow
                      row={row}
                      rank={
                        ranks
                          ? (rankOf.get(row.key + (row.semester ?? '')) ?? null)
                          : null
                      }
                      semester={semester}
                      kind={tab}
                      showSemester={merged.semesters.length > 1}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {limit < filtered.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="bg-card shadow-card hover:bg-accent mt-4 w-full rounded-xl px-4 py-3 text-sm"
        >
          載入更多（再顯示 {Math.min(PAGE, filtered.length - limit)} {UNITS[tab]}）
        </button>
      )}
    </div>
  )
}

/** 載入進度、被排除的學期、以及「這學期還沒開始撤選」這幾件事要講清楚。 */
function Notes({
  pending,
  loaded,
  total,
  range,
  skipped,
  error,
  withdrawn,
  onRange,
}: {
  pending: boolean
  loaded: number
  total: number
  range: Range
  skipped: readonly string[]
  error: Error | null
  withdrawn: number
  onRange: (range: Range) => void
}) {
  if (error) {
    return (
      <p className="bg-destructive/10 text-foreground mt-3 rounded-lg px-4 py-3 text-sm">
        有學期載入失敗，下面的數字並不完整。請重新整理再試。
      </p>
    )
  }

  if (pending) {
    return (
      <div className="bg-secondary/60 mt-3 rounded-lg px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span>
            彙總中，已完成 {loaded} / {total} 個學期
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round((loaded / Math.max(total, 1)) * 100)}%
          </span>
        </div>
        <div className="bg-border mt-2 h-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width]"
            style={{ width: `${(loaded / Math.max(total, 1)) * 100}%` }}
          />
        </div>
        {range === 'all' && (
          <p className="text-muted-foreground mt-2 text-xs">
            所有期間約 4 MB，第一次要等一下；載過的學期之後都直接讀快取。
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      {withdrawn === 0 && (
        <p className="bg-secondary text-foreground mt-3 rounded-lg px-4 py-3 text-sm">
          所選期間還沒有任何撤選紀錄 —— 撤選期通常在學期開始幾週後。{' '}
          <button
            type="button"
            onClick={() => onRange('y3')}
            className="underline underline-offset-4"
          >
            改看過去三年
          </button>
        </p>
      )}
      {/* 少算了 11 個學期而不說,使用者只會覺得數字怪 */}
      {skipped.length > 0 && (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          其中 {skipped.length} 個學期（{skipped[skipped.length - 1]} – {skipped[0]}
          ）的原始課表沒有「人」「撤」兩欄，已排除在統計外。
        </p>
      )}
    </>
  )
}
