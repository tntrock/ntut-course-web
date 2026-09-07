import type { Classroom, ScheduleResponse } from '@/types/api'
import { slotKey } from './filters'

/**
 * 空教室查詢。
 *
 * **兩個現成的端點交叉就夠了**,不必下載 60 個系所檔:
 *
 * - `schedule.json`   星期 × 節次 → 課號（gzip 10 KB）
 * - `classrooms.json` 教室 → 課號（gzip 8 KB）
 *
 * 某教室在某節有課 ⟺ 它的課號清單與該節次的課號清單有交集。
 *
 * ⚠️ **「空」只代表課表上沒排課。** 115-1 實測有 27.6%（726 門）的課有排時段
 * 卻沒登記教室（體育 185 門、各種「向度」與英文課約 200 門是選課後才分班),
 * 那些課實際上還是佔著教室。教室也可能被借用、辦活動或鎖著 —— 那些資料學校
 * 沒有開放。這個限制一定要顯示在畫面上。
 */

/** 選到的格子裡所有正在上課的課號。 */
export function occupiedCourseIds(
  schedule: ScheduleResponse,
  slots: readonly string[],
): Set<string> {
  const wanted = new Set(slots)
  const ids = new Set<string>()

  for (const day of schedule.days) {
    for (const period of day.periods) {
      // 網址是使用者可以亂打的,認不得的格子跳過就好
      if (!wanted.has(slotKey(day.day, period.code))) continue
      for (const id of period.course_ids) ids.add(id)
    }
  }
  return ids
}

/**
 * 選到的格子**每一格都沒課**的教室。
 *
 * 用「全部都空」而不是「有一格空」:使用者框連續幾節是想借那一段時間,
 * 中間卡一堂課就不能用了。
 */
export function freeClassrooms(
  schedule: ScheduleResponse,
  classrooms: readonly Classroom[],
  slots: readonly string[],
): Classroom[] {
  // 一格都沒選時回空陣列 —— 「234 間全部都空」不是有意義的答案
  if (slots.length === 0) return []

  const busy = occupiedCourseIds(schedule, slots)
  return classrooms.filter((room) => !room.course_ids.some((id) => busy.has(id)))
}

/**
 * 教室名稱開頭的中文部分,例如 `三教308(e)` → `三教`。
 *
 * 停在第一個英數字元而不是只停在數字 —— 實測有 `設計B01`、`綜科B..`、
 * `分子BR..` 這種命名,只擋數字會分出「設計B」「綜科B」這些假的建築物。
 */
export function buildingOf(name: string): string {
  const match = /^[^0-9A-Za-z]+/.exec(name)
  return match ? match[0] : name
}

export interface BuildingGroup {
  building: string
  rooms: Classroom[]
}

/** 依建築物分組。234 間平鋪沒辦法看。 */
export function groupByBuilding(classrooms: readonly Classroom[]): BuildingGroup[] {
  const groups = new Map<string, Classroom[]>()
  for (const room of classrooms) {
    const building = buildingOf(room.name)
    const list = groups.get(building)
    if (list) list.push(room)
    else groups.set(building, [room])
  }
  return [...groups].map(([building, rooms]) => ({ building, rooms }))
}

export interface RoomSeats {
  room: Classroom
  /** 座位數。`null` = 學校沒填,**不是 0**。 */
  seats: number | null
}

/** 把容量掛到教室上。查不到就是 `null`。 */
export function withSeats(
  classrooms: readonly Classroom[],
  seats: ReadonlyMap<string, number | null>,
): RoomSeats[] {
  return classrooms.map((room) => ({ room, seats: seats.get(room.id) ?? null }))
}

/**
 * 依座位數篩選。
 *
 * **沒有容量的教室不能悄悄濾掉。** 實測綜科 28 間只有 3 間有容量、設計 24 間
 * 只有 3 間 —— 濾掉的話使用者會以為那兩棟沒有空教室,而事實是我們不知道它多大。
 * 所以另外回傳,由畫面標示成「未提供容量」。
 */
export function filterBySeats(
  rooms: readonly RoomSeats[],
  minSeats: number,
): { enough: RoomSeats[]; unknown: RoomSeats[] } {
  if (minSeats <= 0) return { enough: [...rooms], unknown: [] }
  return {
    enough: rooms.filter((r) => r.seats !== null && r.seats >= minSeats),
    unknown: rooms.filter((r) => r.seats === null),
  }
}

/**
 * 課號 → 教室容量。
 *
 * **輕量索引沒有 `classroom_codes`**（plan.md §1.10），所以搜尋結果的卡片本來
 * 拿不到教室。但 `classrooms.json` 是反過來存的（教室 → 課號），把它反轉就有了
 * —— 兩個檔加起來 gzip 15 KB，比為了幾個數字下載 60 個系所檔便宜得多。
 *
 * 實測反轉結果與系所檔的 `classroom_codes` 逐課比對，資工系 53 門課 53/53 一致。
 *
 * 一門課用多間教室時取**最大**的 —— 這個數字是「最多可能坐多少人」的上界。
 */
export function courseCapacity(
  classrooms: readonly Classroom[],
  seats: ReadonlyMap<string, number | null>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const room of classrooms) {
    const n = seats.get(room.id)
    // 沒有容量就不要放進去 —— 放 0 會讓畫面顯示「教室 0 人」
    if (n === null || n === undefined) continue
    for (const id of room.course_ids) {
      const prev = out.get(id)
      if (prev === undefined || n > prev) out.set(id, n)
    }
  }
  return out
}
