import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { fetchDepartments } from '@/lib/api'
import { toFilters, validateSearchParams, type SearchParams } from '@/lib/searchParams'
import type { SortKey } from '@/lib/searchParams'
import type { RelaxTarget } from '@/lib/suggest'
import { activeFilterCount } from '@/lib/filters'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { semesterIndexQueryOptions, useSemesterIndex } from '@/hooks/useSemesterIndex'
import { useCourseSearch } from '@/hooks/useCourseSearch'
import { useDebounced } from '@/hooks/useDebounced'
import { FilterPanel, type FilterValues } from '@/components/search/FilterPanel'
import { ResultList } from '@/components/search/ResultList'
import { EmptyResults } from '@/components/search/EmptyResults'
import { useSuspenseQuery, queryOptions } from '@tanstack/react-query'
import type { Meta } from '@/types/api'

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

function departmentsQueryOptions(meta: Meta, semester: string) {
  const version =
    meta.semesters.find((s) => s.path === semester)?.generated_at ?? 'unknown'
  return queryOptions({
    queryKey: ['departments', semester, version],
    queryFn: () => fetchDepartments(meta, semester),
    staleTime: Infinity,
  })
}

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

  // 輸入框自己維持狀態,debounce 之後才寫回網址 ——
  // 每個按鍵都推一次歷史紀錄的話,上一頁會變成一個字一個字倒退
  const [draft, setDraft] = useState(params.q ?? '')

  // 網址上的關鍵字變了(上一頁、點了建議、外部連結)就同步回輸入框。
  // 用 render 期調整而不是 useEffect —— effect 會多跑一輪 render,
  // 而且輸入框會先閃一下舊值。這是 React 官方對「prop 變了要重設 state」的建議做法。
  const [lastQ, setLastQ] = useState(params.q)
  if (params.q !== lastQ) {
    setLastQ(params.q)
    setDraft(params.q ?? '')
  }

  const debounced = useDebounced(draft)

  useEffect(() => {
    if (debounced === (params.q ?? '')) return
    void navigate({
      search: (prev: SearchParams) => {
        const next = { ...prev }
        // exactOptionalPropertyTypes 下不能塞 undefined,要真的把 key 拿掉
        if (debounced === '') delete next.q
        else next.q = debounced
        return next
      },
      replace: true,
    })
  }, [debounced, params.q, navigate])

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

  const [filtersOpen, setFiltersOpen] = useState(false)
  const appliedCount = activeFilterCount(filters)

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="bg-background sticky top-0 z-10 flex items-center gap-2 py-3">
        <input
          type="search"
          name="q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="課名、教師、課號"
          aria-label="搜尋課程"
          autoFocus
          className="bg-background focus-visible:ring-ring flex-1 rounded-lg border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
        />

        <select
          name="sem"
          value={semester}
          aria-label="學期"
          onChange={(e) =>
            void navigate({
              search: (prev: SearchParams) => ({ ...prev, sem: e.target.value }),
            })
          }
          className="bg-background rounded-lg border px-2 py-2 text-sm"
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
          className="bg-background hidden rounded-lg border px-2 py-2 text-sm sm:block"
        >
          <option value="relevance">相關度</option>
          <option value="name">課名</option>
          <option value="credits">學分</option>
          <option value="enrolled">修課人數</option>
        </select>

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="hover:bg-accent rounded-lg border px-3 py-2 text-sm md:hidden"
        >
          篩選{appliedCount > 0 ? ` (${appliedCount})` : ''}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside
          className={`md:sticky md:top-16 md:block md:self-start ${
            filtersOpen ? 'block' : 'hidden'
          }`}
        >
          <FilterPanel
            courses={index.courses}
            departments={departments}
            periods={meta.periods}
            values={values}
            onChange={applyFilterChange}
          />
        </aside>

        <main>
          <p className="text-muted-foreground py-2 text-sm" aria-live="polite">
            {result.loading
              ? '建立索引中…'
              : `${result.total.toLocaleString('zh-TW')} 門課`}
          </p>

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
