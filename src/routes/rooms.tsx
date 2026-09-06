import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { TimeGrid } from '@/components/search/TimeGrid'
import { classroomsQueryOptions, scheduleQueryOptions } from '@/hooks/useBrowse'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { freeClassrooms, groupByBuilding } from '@/lib/rooms'
import type { SemesterPath } from '@/types/api'

interface RoomsSearch {
  sem?: string
  /** 選到的格子,`{星期}-{節次}`。用重複的 key 放在網址上。 */
  slot?: string[]
}

export const Route = createFileRoute('/rooms')({
  validateSearch: (search: Record<string, unknown>): RoomsSearch => {
    const out: RoomsSearch = {}
    if (typeof search.sem === 'string' && search.sem !== '') out.sem = search.sem
    const slot = search.slot
    if (Array.isArray(slot)) {
      const keys = slot.filter((s): s is string => typeof s === 'string' && s !== '')
      if (keys.length > 0) out.slot = keys
    } else if (typeof slot === 'string' && slot !== '') {
      out.slot = [slot]
    }
    return out
  },

  loaderDeps: ({ search }) => ({ sem: search.sem }),

  loader: async ({ context, deps }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    const semester = deps.sem ?? meta.latest
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(classroomsQueryOptions(meta, semester)),
    ])
  },

  component: RoomsPage,
})

function RoomsPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: meta } = useMeta()

  const semester: SemesterPath = params.sem ?? meta.latest
  const slots = params.slot ?? []

  const schedule = useSuspenseQuery(scheduleQueryOptions(meta, semester)).data
  const classrooms = useSuspenseQuery(classroomsQueryOptions(meta, semester)).data

  const free = freeClassrooms(schedule, classrooms.classrooms, slots)
  const groups = groupByBuilding(free)

  const setSlots = (next: string[]) => {
    void navigate({
      search: (prev: RoomsSearch) => {
        const out: RoomsSearch = {}
        if (prev.sem !== undefined) out.sem = prev.sem
        if (next.length > 0) out.slot = next
        return out
      },
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">空教室</h1>
        <select
          name="sem"
          value={semester}
          aria-label="學期"
          onChange={(e) => void navigate({ search: { sem: e.target.value } })}
          className="bg-card rounded-lg border px-2 py-1 text-sm"
        >
          {meta.semesters.map((s) => (
            <option key={s.path} value={s.path}>
              {s.path}
            </option>
          ))}
        </select>
      </div>

      <p className="text-muted-foreground mt-2 text-sm">
        框選時段，列出那幾節<strong className="text-foreground">全部都沒課</strong>
        的教室。
      </p>

      <div className="bg-card shadow-card mt-4 rounded-xl p-4">
        <TimeGrid
          periods={meta.periods}
          selected={slots}
          onToggle={(key) =>
            setSlots(
              slots.includes(key) ? slots.filter((s) => s !== key) : [...slots, key],
            )
          }
          onClear={() => setSlots([])}
        />
      </div>

      {/* 這個數字不能只當統計 —— 它是「空」這個字唯一誠實的註腳 */}
      <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
        「空」只代表<strong className="text-foreground">課表上沒有排課</strong>
        ，不代表現在可以進去用。教室可能被借用、辦活動或鎖著，那些資料學校沒有開放；
        而且有些課（體育、尚未分班的通識與英文）本來就沒有登記教室，
        它們佔用的教室這裡看不到。實際要用請以現場為準。
      </p>

      {slots.length === 0 ? (
        <p className="text-muted-foreground bg-card shadow-card mt-4 rounded-xl px-4 py-16 text-center text-sm">
          先在上面框選想要的時段。
        </p>
      ) : free.length === 0 ? (
        <p className="text-muted-foreground bg-card shadow-card mt-4 rounded-xl px-4 py-16 text-center text-sm">
          這 {slots.length} 個時段沒有完全空著的教室。試著少選幾格。
        </p>
      ) : (
        <>
          <p className="mt-5 text-sm">
            <strong className="tabular-nums">{free.length}</strong>
            <span className="text-muted-foreground"> 間教室在選到的 </span>
            <strong className="tabular-nums">{slots.length}</strong>
            <span className="text-muted-foreground"> 個時段都沒課</span>
          </p>

          <div className="mt-3 space-y-5">
            {groups.map((group) => (
              <section key={group.building}>
                <h2 className="text-muted-foreground mb-1.5 text-xs font-medium">
                  {group.building}
                  <span className="ml-2 tabular-nums">{group.rooms.length}</span>
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {group.rooms.map((room) => (
                    <Link
                      key={room.id}
                      to="/classroom/$semester/$classroomId"
                      params={{ semester, classroomId: room.id }}
                      className="bg-card shadow-card hover:bg-accent rounded-lg px-2.5 py-1.5 text-sm"
                    >
                      {room.name}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
