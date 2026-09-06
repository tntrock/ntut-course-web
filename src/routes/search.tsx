import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { toFilters, validateSearchParams, type SearchParams } from '@/lib/searchParams'
import type { SortKey } from '@/lib/searchParams'
import type { RelaxTarget } from '@/lib/suggest'
import { activeFilterCount } from '@/lib/filters'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import { useCourseSearch } from '@/hooks/useCourseSearch'
import { FilterPanel, type FilterValues } from '@/components/search/FilterPanel'
import { ResultList } from '@/components/search/ResultList'
import { EmptyResults } from '@/components/search/EmptyResults'
import { useSuspenseQuery } from '@tanstack/react-query'
import { departmentsQueryOptions } from '@/hooks/useDepartments'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams =>
    validateSearchParams(search),
  // 只有學期會改變要載入的資料,其餘條件都在前端算
  loaderDeps: ({ search }) => ({ sem: search.sem }),
  /**
   * 索引與系所對照**並行**取得。
   *
   * 交給元件裡的 suspense 去抓的話會變成瀑布:index 解析完才輪到 departments,
   * 冷快取下多花約 260ms。兩者都只依賴 meta,沒有理由排隊。
   */
  loader: async ({ context, deps }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    const semester = deps.sem ?? meta.latest
    await Promise.all([
      context.queryClient.ensureQueryData(semesterIndexQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(departmentsQueryOptions(meta, semester)),
    ])
  },
  component: SearchPage,
})

/** 移除某個條件後的網址參數。 */
function withoutFilter(params: SearchParams, target: RelaxTarget): SearchParams {
  const next = { ...params }
  switch (target) {
    case 'query':
      delete next.q
      break
    case 'departments':
      delete next.dept
      break
    case 'requirementTypes':
      delete next.req
      break
    case 'languages':
      delete next.lang
      break
    case 'slots':
      delete next.slot
      break
    case 'credits':
      delete next.cmin
      delete next.cmax
      break
    case 'teacherCode':
      delete next.teacher
      break
    case 'classId':
      delete next.class
      break
    case 'courseIdSet':
      delete next.program
      delete next.classroom
      break
  }
  return next
}

function SearchPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()

  const semester = params.sem ?? meta.latest
  const index = useSemesterIndex(meta, semester)
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data

  // 關鍵字輸入框在頁首(見 components/AppHeader)。搜尋頁只從網址讀值 ——
  // 兩個地方各放一個搜尋框,使用者就得猜哪一個才算數。
  const filters = useMemo(() => toFilters(params, null), [params])
  const sort: SortKey = params.sort ?? 'relevance'
  const result = useCourseSearch(index.courses, params.q ?? '', filters, sort)

  const values: FilterValues = {
    dept: params.dept ?? [],
    req: params.req ?? [],
    lang: params.lang ?? [],
    slot: params.slot ?? [],
    time: params.time ?? 'includes',
    cmin: params.cmin,
    cmax: params.cmax,
  }

  const applyFilterChange = (patch: Partial<FilterValues>) => {
    void navigate({
      search: (prev: SearchParams) => {
        const next: SearchParams = { ...prev }

        for (const [key, value] of Object.entries(patch)) {
          const isEmpty =
            value === undefined || (Array.isArray(value) && value.length === 0)
          // 空陣列與 undefined 不要留在網址上
          if (isEmpty) delete next[key as keyof SearchParams]
          else Object.assign(next, { [key]: value })
        }

        return next
      },
    })
  }

  /** 清除所有篩選條件,但**留著關鍵字與學期** —— 那兩個不是「篩選」。 */
  const clearFilters = () => {
    void navigate({
      search: (prev: SearchParams) => {
        const next: SearchParams = { ...prev }
        for (const key of [
          'dept',
          'req',
          'lang',
          'slot',
          'time',
          'cmin',
          'cmax',
        ] as const) {
          delete next[key]
        }
        return next
      },
    })
  }

  const [filtersOpen, setFiltersOpen] = useState(false)
  const appliedCount = activeFilterCount(filters)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      {/*
        工具列黏在頁首下方（頁首高 3.25rem）。原本搜尋框、學期、排序、篩選鈕
        全部擠在同一列，寬螢幕下右邊一大片空的、手機上又擠成一團。
      */}
      <div className="bg-background/85 sticky top-13 z-20 flex items-center gap-2 py-2.5 backdrop-blur">
        <p className="flex-1 text-sm" aria-live="polite">
          {result.loading ? (
            <span className="text-muted-foreground">建立索引中…</span>
          ) : (
            <>
              <span className="font-medium tabular-nums">
                {result.total.toLocaleString('zh-TW')}
              </span>
              <span className="text-muted-foreground"> 門課</span>
            </>
          )}
        </p>

        <select
          name="sem"
          value={semester}
          aria-label="學期"
          onChange={(e) =>
            void navigate({
              search: (prev: SearchParams) => ({ ...prev, sem: e.target.value }),
            })
          }
          className="bg-card rounded-lg border px-2 py-1.5 text-sm"
        >
          {meta.semesters.map((s) => (
            <option key={s.path} value={s.path}>
              {s.path}
            </option>
          ))}
        </select>

        <select
          name="sort"
          value={sort}
          aria-label="排序"
          onChange={(e) =>
            void navigate({
              search: (prev: SearchParams) => ({
                ...prev,
                sort: e.target.value as SortKey,
              }),
            })
          }
          className="bg-card hidden rounded-lg border px-2 py-1.5 text-sm sm:block"
        >
          <option value="relevance">相關度</option>
          <option value="name">課名</option>
          <option value="credits">學分</option>
          <option value="enrolled">修課人數</option>
        </select>

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={`focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none md:hidden ${
            appliedCount > 0
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-card hover:bg-accent'
          }`}
        >
          篩選{appliedCount > 0 ? ` ${appliedCount}` : ''}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        {/*
          側欄釘在工具列下方，但**高度要收在視窗內**。
          展開「學院 / 系所」後面板有 1,300px 高，視窗只有 800px —— 純 sticky 會把
          超出的部分永遠釘在畫面外，底下的「星期 / 節次」與「學分」再也點不到。

          內部捲軸只在展開長分區時才出現（分區預設收合），不是常駐的那種。

          `overflow-x-hidden` 是必要的：CSS 規範規定 `overflow-y` 一旦不是
          `visible`，`overflow-x` 就會跟著算成 `auto` —— 內容只要凸出幾個像素，
          就會冒出一條左右橫移的捲軸。這裡沒有任何東西需要橫向捲動。
        */}
        <aside
          className={`md:sticky md:top-24 md:block md:max-h-[calc(100dvh-7rem)] md:self-start md:overflow-x-hidden md:overflow-y-auto md:pr-1 ${
            filtersOpen ? 'block' : 'hidden'
          }`}
        >
          <FilterPanel
            courses={index.courses}
            departments={departments}
            periods={meta.periods}
            values={values}
            onChange={applyFilterChange}
            onClear={clearFilters}
          />
        </aside>

        {/* 撐住高度，結果還沒算完時頁尾才不會先跑上來又被推走（見 __root 的 Loading） */}
        <main className="min-h-[80dvh] min-w-0">
          {!result.loading && result.total === 0 ? (
            <EmptyResults
              suggestions={result.suggestions}
              onRelax={(target) =>
                void navigate({ search: () => withoutFilter(params, target) })
              }
            />
          ) : (
            <ResultList
              courses={result.courses}
              semester={semester}
              periods={meta.periods}
            />
          )}
        </main>
      </div>
    </div>
  )
}
