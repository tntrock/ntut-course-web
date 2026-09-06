import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ClassroomTab } from '@/components/browse/ClassroomTab'
import { DeptTab } from '@/components/browse/DeptTab'
import { ProgramTab } from '@/components/browse/ProgramTab'
import { TeacherTab } from '@/components/browse/TeacherTab'
import {
  classroomsQueryOptions,
  programsQueryOptions,
  teachersQueryOptions,
} from '@/hooks/useBrowse'
import { useDebounced } from '@/hooks/useDebounced'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import {
  BROWSE_TAB_LABELS,
  BROWSE_TABS,
  isBrowseTab,
  type BrowseTab,
} from '@/lib/browseTabs'

interface BrowseSearch {
  sem?: string
  tab?: BrowseTab
  q?: string
}

export const Route = createFileRoute('/browse')({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const out: BrowseSearch = {}
    if (typeof search.sem === 'string' && search.sem !== '') out.sem = search.sem
    if (isBrowseTab(search.tab)) out.tab = search.tab
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
  const tab: BrowseTab = params.tab ?? 'dept'

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
  const setSearch = (patch: {
    sem?: string
    tab?: BrowseTab
    q?: string | undefined
  }) => {
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
        {BROWSE_TABS.map((t) => (
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
            {BROWSE_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <input
        type="search"
        name="q"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`搜尋${BROWSE_TAB_LABELS[tab]}`}
        aria-label={`搜尋${BROWSE_TAB_LABELS[tab]}`}
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
