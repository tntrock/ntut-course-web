import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries, useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { changesQueryOptions, classesQueryOptions } from '@/hooks/useBrowse'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import {
  groupByDate,
  isStale,
  semestersNeedingNames,
  type NameLookup,
} from '@/lib/changes'
import { formatTaipei, hoursSince } from '@/lib/datetime'
import { EventCard } from '@/components/changes/EventCard'
import type { Meta } from '@/types/api'

export const Route = createFileRoute('/changes')({
  loader: async ({ context }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    await context.queryClient.ensureQueryData(changesQueryOptions(meta))
  },
  component: ChangesPage,
})

function ChangesPage() {
  const { data: meta } = useMeta()
  const changes = useSuspenseQuery(changesQueryOptions(meta)).data

  const names = useNameLookup(meta, semestersNeedingNames(changes.events))
  const groups = groupByDate(changes.events)
  const stale = isStale(changes.checked_at)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">最近異動</h1>

      <p
        className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-xs ${
          stale ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'
        }`}
      >
        最後檢查 {formatTaipei(changes.checked_at)}
        {stale && `（已過 ${hoursSince(changes.checked_at)} 小時）`}
      </p>

      {/*
        這兩件事一定要分清楚，否則使用者會把「爬蟲掛了」當成「學校沒動」:
        檢查時間是今天但沒有事件 = 學校真的沒動；檢查時間停在幾天前 = 爬蟲沒在跑。
      */}
      {stale && (
        <p className="text-muted-foreground mt-2 text-sm">
          距離上次檢查已經超過 12 小時，下面的內容可能不是最新的。
        </p>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        時間是<strong className="font-medium">本站偵測到</strong>
        異動的時刻，不是學校異動的時刻 —— 實際異動發生在前一次抓取與這次之間。
      </p>

      {groups.length === 0 ? (
        <Empty stale={stale} checkedAt={changes.checked_at} />
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="text-muted-foreground text-xs font-medium tabular-nums">
                {group.date}
              </h2>
              <div className="mt-2 space-y-2">
                {group.events.map((event, i) => (
                  <EventCard
                    key={`${event.type}-${event.at}-${i}`}
                    event={event}
                    names={names}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Empty({ stale, checkedAt }: { stale: boolean; checkedAt: string }) {
  return (
    <div className="bg-card shadow-card mt-6 rounded-xl px-4 py-16 text-center">
      <p className="font-medium">近期無異動</p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
        {stale
          ? `最後一次檢查是 ${formatTaipei(checkedAt)}，已經有一段時間沒更新了 —— 這比較像是資料來源沒在跑，而不是學校真的沒有異動。`
          : '資料來源剛檢查過，學校這陣子沒有新增或停開課程。'}
      </p>
      <Link to="/search" className="mt-5 inline-block text-sm underline">
        去搜尋課程
      </Link>
    </div>
  )
}

/**
 * 系所與班級代碼 → 中文名。
 *
 * 事件橫跨多個學期,而名稱對照是**逐學期**的檔案。只為真的有代碼的學期取
 * (見 `semestersNeedingNames`)—— 實測 15 筆事件橫跨 7 個學期,但只有 1 個
 * 學期需要對照,不篩的話會多打十幾個請求。
 */
function useNameLookup(meta: Meta, semesters: readonly string[]): NameLookup {
  const results = useQueries({
    queries: semesters.flatMap((semester) => [
      { ...departmentsQueryOptions(meta, semester) },
      { ...classesQueryOptions(meta, semester) },
    ]),
  })

  const departmentNames = new Map<string, string>()
  const classNames = new Map<string, string>()

  for (const result of results) {
    const data = result.data
    if (!data) continue
    if ('departments' in data) {
      for (const d of data.departments) departmentNames.set(d.id, d.name)
    }
    if ('classes' in data) {
      for (const c of data.classes) classNames.set(c.id, c.name)
    }
  }

  return {
    // 對照還沒到、或那個學期沒有這個代碼時,原樣顯示代碼而不是空白
    department: (id) => departmentNames.get(id) ?? id,
    classGroup: (id) => classNames.get(id) ?? id,
  }
}
