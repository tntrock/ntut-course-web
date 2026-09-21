import type { SemesterPath, TimeSlot } from '@/types/api'
import { readRaw, removeRaw, writeRaw } from './webStorage'

/**
 * 個人事務:打工、社團、通勤這類固定時段。
 *
 * **刻意存在另一個 localStorage key,不放進 `Store`。** 兩個理由,都來自
 * `storage.ts` 現有的行為:
 *
 * 1. `loadStore()` 看到比自己新的 `version` 會 `backupAndReset`。service
 *    worker 是 `prompt` 模式,使用者可以一直不更新 —— 新分頁寫了 v2、舊分頁
 *    讀到就把課表重置,即使有備份,畫面上就是「課表不見了」。所以版本號不動。
 * 2. `loadStore()` 是**重建**而不是合併(只讀 version / schedules /
 *    favorites / settings 四個 key)。塞進 `Store` 的新欄位會被舊版程式讀掉,
 *    下次存檔就永久消失。
 *
 * 分開存的結果:舊版程式看不到事務,但也**毀不掉**它。
 *
 * 兩條硬規則跟 `storage.ts` 一致 —— 永不丟例外、絕不靜默丟掉資料。
 */

export const EVENTS_KEY = 'ntut-course-web:v1.events'
export const EVENTS_BACKUP_KEY = 'ntut-course-web:v1.events.backup'

export interface PersonalEvent {
  /** 一律帶 `evt_` 前綴 —— 課號是純數字,兩邊的 id 永遠不可能相等。 */
  id: string
  title: string
  /** 跟 `CourseSnapshot` 同一個型別,排版才能共用。 */
  time_slots: TimeSlot[]
  note: string | null
  createdAt: string
}

/** 各學期獨立,跟 `Store['schedules']` 一致。 */
export type EventStore = Record<SemesterPath, PersonalEvent[]>

export const MAX_TITLE = 20

/**
 * 產生一筆新事務。
 *
 * id 用 `crypto.randomUUID()` 而不是時間戳:同一秒內連續加兩筆會撞。
 * `randomUUID` 在非安全來源不存在,退回亂數 —— 這裡不需要密碼學強度,
 * 只要不重複。
 */
export function newEvent(
  title: string,
  timeSlots: TimeSlot[],
  note: string | null,
): PersonalEvent {
  const random =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

  return {
    id: `evt_${random}`,
    title: title.trim().slice(0, MAX_TITLE),
    time_slots: timeSlots,
    note: note?.trim() ? note.trim() : null,
    createdAt: new Date().toISOString(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toTimeSlots(value: unknown): TimeSlot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!isRecord(raw)) return []
    if (typeof raw.day !== 'number' || raw.day < 0 || raw.day > 6) return []
    const periods = Array.isArray(raw.periods)
      ? raw.periods.filter((p): p is string => typeof p === 'string')
      : []
    if (periods.length === 0) return []
    return [
      {
        day: raw.day as TimeSlot['day'],
        day_name: typeof raw.day_name === 'string' ? raw.day_name : '',
        periods,
      },
    ]
  })
}

/** 壞掉的單筆濾掉,但**不牽連同一學期的其他事務**。 */
function toEvents(value: unknown): PersonalEvent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!isRecord(raw)) return []
    if (typeof raw.id !== 'string' || raw.id === '') return []
    // 沒有名稱的事務在格子裡是一塊沒有標示的色塊,救不回來也講不清楚
    if (typeof raw.title !== 'string' || raw.title.trim() === '') return []
    return [
      {
        id: raw.id,
        title: raw.title.slice(0, MAX_TITLE),
        time_slots: toTimeSlots(raw.time_slots),
        note: typeof raw.note === 'string' && raw.note !== '' ? raw.note : null,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      },
    ]
  })
}

export function toEventStore(value: unknown): EventStore {
  if (!isRecord(value)) return {}
  const out: EventStore = {}
  for (const [semester, entry] of Object.entries(value)) {
    out[semester] = toEvents(entry)
  }
  return out
}

/**
 * 整包救不回來時:原樣備份,再寫回乾淨狀態。
 *
 * **重置要真的寫回去** —— 只備份不覆蓋的話每次載入都重新備份一次,
 * 而且使用者永遠停在壞掉的狀態。
 */
function backupAndReset(raw: string): EventStore {
  writeRaw(EVENTS_BACKUP_KEY, raw)
  writeRaw(EVENTS_KEY, '{}')
  return {}
}

export function loadEvents(): EventStore {
  const raw = readRaw(EVENTS_KEY)
  if (raw === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return backupAndReset(raw)
  }

  if (!isRecord(parsed)) return backupAndReset(raw)

  return toEventStore(parsed)
}

export function saveEvents(events: EventStore): boolean {
  return writeRaw(EVENTS_KEY, JSON.stringify(events))
}

export function readEventsBackup(): string | null {
  return readRaw(EVENTS_BACKUP_KEY)
}

export function clearEventsBackup(): void {
  removeRaw(EVENTS_BACKUP_KEY)
}
