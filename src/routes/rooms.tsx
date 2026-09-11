import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { TimeGrid } from '@/components/search/TimeGrid'
import {
  capacityQueryOptions,
  classroomsQueryOptions,
  scheduleQueryOptions,
} from '@/hooks/useBrowse'
import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import {
  filterBySeats,
  freeClassrooms,
  groupByBuilding,
  withSeats,
  type RoomSeats,
} from '@/lib/rooms'
import type { SemesterPath } from '@/types/api'
import { pageHead } from '@/lib/seo'

/** 常見的教室規模。實測容量分布 10 ~ 420,中位數 50。 */
const SEAT_OPTIONS = [0, 30, 50, 80, 120] as const

interface RoomsSearch {
  sem?: string
  /** 選到的格子,`{星期}-{節次}`。用重複的 key 放在網址上。 */
  slot?: string[]
  /** 最少座位數。 */
  seats?: number
}

export const Route = createFileRoute('/rooms')({
  head: () =>
    pageHead({
      subject: '空教室',
      description: '查臺北科技大學指定時段的空教室，可依座位數篩選。',
      path: '/rooms',
    }),
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
    const seats = Number(search.seats)
    if (Number.isFinite(seats) && seats > 0) out.seats = seats
    return out
  },

  loaderDeps: ({ search }) => ({ sem: search.sem }),

  loader: async ({ context, deps }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    const semester = deps.sem ?? meta.latest
    await Promise.all([
      context.queryClient.ensureQueryData(scheduleQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(classroomsQueryOptions(meta, semester)),
      context.queryClient.ensureQueryData(capacityQueryOptions(meta)),
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
  const minSeats = params.seats ?? 0

  const schedule = useSuspenseQuery(scheduleQueryOptions(meta, semester)).data
  const classrooms = useSuspenseQuery(classroomsQueryOptions(meta, semester)).data
  const capacity = useSuspenseQuery(capacityQueryOptions(meta)).data

  const seatMap = new Map(
    Object.entries(capacity.classrooms).map(([id, c]) => [id, c.capacity]),
  )
  const free = withSeats(
    freeClassrooms(schedule, classrooms.classrooms, slots),
    seatMap,
  )
  const { enough, unknown } = filterBySeats(free, minSeats)
  const groups = groupByBuilding(enough.map((r) => r.room))
  const seatsOf = new Map(free.map((r) => [r.room.id, r.seats]))

  const setSeats = (n: number) => {
    void navigate({
      search: (prev: RoomsSearch) => {
        const out: RoomsSearch = { ...prev }
        if (n > 0) out.seats = n
        else delete out.seats
        return out
      },
    })
  }

  const setSlots = (next: string[]) => {
    void navigate({
      search: (prev: RoomsSearch) => {
        const out: RoomsSearch = {}
        if (prev.sem !== undefined) out.sem = prev.sem
        if (prev.seats !== undefined) out.seats = prev.seats
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
          className="bg-card border-input rounded-lg border px-2 py-1 text-sm"
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
        <label className="text-muted-foreground mb-3 block text-xs">
          至少坐得下{' '}
          <select
            value={minSeats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="bg-background text-foreground border-input rounded border px-1.5 py-1 text-xs"
          >
            {SEAT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? '不限' : `${n} 人`}
              </option>
            ))}
          </select>
        </label>
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
            <strong className="tabular-nums">{enough.length}</strong>
            <span className="text-muted-foreground"> 間教室在選到的 </span>
            <strong className="tabular-nums">{slots.length}</strong>
            <span className="text-muted-foreground"> 個時段都沒課</span>
            {minSeats > 0 && (
              <span className="text-muted-foreground">，且坐得下 {minSeats} 人</span>
            )}
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
                    <RoomChip
                      key={room.id}
                      semester={semester}
                      room={room}
                      seats={seatsOf.get(room.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* 濾掉就等於騙人 —— 綜科 28 間只有 3 間有容量,設計 24 間只有 3 間。
              不知道多大不等於坐不下 */}
          {unknown.length > 0 && (
            <section className="mt-6 border-t pt-4">
              <h2 className="text-muted-foreground mb-1.5 text-xs font-medium">
                未提供容量
                <span className="ml-2 tabular-nums">{unknown.length}</span>
              </h2>
              <p className="text-muted-foreground mb-2 text-xs">
                這些教室在選到的時段也沒課，但學校沒有填座位數 ——
                不知道多大，不代表坐不下。
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unknown.map(({ room }) => (
                  <RoomChip
                    key={room.id}
                    semester={semester}
                    room={room}
                    seats={null}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function RoomChip({
  semester,
  room,
  seats,
}: {
  semester: SemesterPath
  room: RoomSeats['room']
  seats: number | null
}) {
  return (
    <Link
      to="/classroom/$semester/$classroomId"
      params={{ semester, classroomId: room.id }}
      className="bg-card shadow-card hover:bg-accent flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5 text-sm"
    >
      {room.name}
      {seats !== null && (
        <span className="text-muted-foreground text-xs tabular-nums">{seats} 人</span>
      )}
    </Link>
  )
}
