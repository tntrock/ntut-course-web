import { useState } from 'react'
import type { Day, PeriodDef, TimeSlot } from '@/types/api'
import { MAX_TITLE, newEvent, type PersonalEvent } from '@/lib/events'
import { updateEvents } from '@/hooks/useEvents'
import { dayName } from '@/lib/formatTime'

/**
 * 個人事務的新增與刪除。
 *
 * **只讓使用者選節次,不給任意時間。** 課表是節次格線,任意時間會逼出一套
 * 新的排版規則,而「18:00 的打工跟第 9 節的課有沒有撞」也會變成得解釋的事。
 * 節次對得上,衝堂的判斷才有意義。
 *
 * 星期與節次都**從 `meta.periods` 的陣列順序來**,不自己排 ——
 * 順序是 `1 2 3 4 N 5 6 7 8 9 A B C D`,4 之後是午休 N,9 之後是夜間 A。
 */

const DAYS: Day[] = [1, 2, 3, 4, 5, 6, 0]

const FIELD = 'bg-card border-input rounded-lg border px-2 py-1.5 text-sm'

export function EventEditor({
  semester,
  events,
  periods,
}: {
  semester: string
  events: readonly PersonalEvent[]
  periods: readonly PeriodDef[]
}) {
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<Day>(1)
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    if (title.trim() === '') {
      setError('請給這筆事務一個名稱。')
      return
    }
    // 起迄選反了不當作錯誤,直接換過來 —— 使用者要的東西很明確
    const [lo, hi] = from <= to ? [from, to] : [to, from]
    const codes = periods.slice(lo, hi + 1).map((p) => p.code)
    if (codes.length === 0) {
      setError('選不到節次。')
      return
    }

    const slot: TimeSlot = { day, day_name: dayName(day), periods: codes }
    const created = newEvent(title, [slot], note)

    const ok = updateEvents((store) => ({
      ...store,
      [semester]: [...(store[semester] ?? []), created],
    }))

    if (!ok) {
      // 存不下就講出來。假裝成功的話使用者重新整理才會發現東西不見了
      setError('存不下來,瀏覽器的儲存空間可能已滿或被停用。')
      return
    }

    setTitle('')
    setNote('')
    setError(null)
  }

  const remove = (id: string) => {
    updateEvents((store) => ({
      ...store,
      [semester]: (store[semester] ?? []).filter((e) => e.id !== id),
    }))
  }

  return (
    <section className="mt-6">
      <h2 className="text-muted-foreground text-xs font-medium">個人事務</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        打工、社團、通勤這類固定時段。只存在這台裝置上，不會上傳。
      </p>

      {events.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="bg-card shadow-card flex items-center justify-between gap-2 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="text-muted-foreground text-xs">
                  {event.time_slots
                    .map((s) => `週${dayName(s.day)} ${s.periods.join('、')}`)
                    .join('，')}
                  {event.note && ` · ${event.note}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(event.id)}
                aria-label={`刪除 ${event.title}`}
                className="text-muted-foreground hover:text-destructive shrink-0 text-xs"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">名稱</span>
          <input
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="打工"
            className={`${FIELD} w-28`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">星期</span>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value) as Day)}
            className={FIELD}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                週{dayName(d)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">從</span>
          <select
            value={from}
            aria-label="起始節次"
            onChange={(e) => setFrom(Number(e.target.value))}
            className={FIELD}
          >
            {periods.map((p, i) => (
              <option key={p.code} value={i}>
                {p.code} ({p.start})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">到</span>
          <select
            value={to}
            aria-label="結束節次"
            onChange={(e) => setTo(Number(e.target.value))}
            className={FIELD}
          >
            {periods.map((p, i) => (
              <option key={p.code} value={i}>
                {p.code} ({p.end})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">備註</span>
          <input
            value={note}
            maxLength={30}
            onChange={(e) => setNote(e.target.value)}
            placeholder="選填"
            className={`${FIELD} w-28`}
          />
        </label>

        <button
          type="button"
          onClick={add}
          className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          加入
        </button>
      </div>

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
    </section>
  )
}
