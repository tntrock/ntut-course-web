import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearEventsBackup,
  EVENTS_BACKUP_KEY,
  EVENTS_KEY,
  loadEvents,
  newEvent,
  readEventsBackup,
  saveEvents,
  type EventStore,
} from './events'
import { loadStore, STORAGE_KEY } from './storage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function slot(day: number, periods: string[]) {
  return { day, day_name: '', periods } as never
}

describe('loadEvents', () => {
  it('第一次使用時回傳空的,不是 null', () => {
    expect(loadEvents()).toEqual({})
  })

  it('讀得回自己存進去的內容', () => {
    const events: EventStore = {
      '115-1': [newEvent('打工', [slot(3, ['5', '6'])], null)],
    }
    saveEvents(events)

    expect(loadEvents()['115-1']?.[0]?.title).toBe('打工')
  })

  /** 課號跨學期不通用,事務也一樣各學期獨立。 */
  it('各學期獨立', () => {
    saveEvents({
      '115-1': [newEvent('打工', [slot(3, ['5'])], null)],
      '114-2': [newEvent('社團', [slot(1, ['A'])], null)],
    })

    const loaded = loadEvents()
    expect(loaded['115-1']?.map((e) => e.title)).toEqual(['打工'])
    expect(loaded['114-2']?.map((e) => e.title)).toEqual(['社團'])
  })

  /** 第一條硬規則:永遠不丟例外、永遠回傳可用的結構。 */
  it('內容壞掉時不丟例外', () => {
    localStorage.setItem(EVENTS_KEY, '{ 這不是 JSON')

    expect(() => loadEvents()).not.toThrow()
    expect(loadEvents()).toEqual({})
  })

  /** 第二條硬規則:絕不靜默丟掉資料。 */
  it('內容壞掉時先原樣備份再重置', () => {
    localStorage.setItem(EVENTS_KEY, '{ 壞掉的內容')
    loadEvents()

    expect(readEventsBackup()).toBe('{ 壞掉的內容')
    // 重置要真的寫回去,否則每次載入都重新備份一次
    expect(localStorage.getItem(EVENTS_KEY)).toBe('{}')

    clearEventsBackup()
    expect(readEventsBackup()).toBeNull()
  })

  it('localStorage 不可用時當作沒有資料,不丟例外', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('無痕視窗')
    })

    expect(() => loadEvents()).not.toThrow()
    expect(loadEvents()).toEqual({})
  })

  /** 壞掉的單筆不該牽連同一學期的其他事務。 */
  it('沒有 id 或 title 的項目濾掉,其他照留', () => {
    localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify({
        '115-1': [
          { id: '', title: '沒有 id', time_slots: [] },
          { id: 'evt_1', title: '', time_slots: [] },
          { id: 'evt_2', title: '留下來', time_slots: [], note: null },
        ],
      }),
    )

    expect(loadEvents()['115-1']?.map((e) => e.title)).toEqual(['留下來'])
  })
})

/**
 * **最關鍵的一條。**
 *
 * 事務刻意存在另一個 key,就是為了讓還沒更新的舊分頁碰不到它 —— 舊版的
 * `loadStore()` 是重建而不是合併,放進 Store 的未知欄位會被它吃掉。
 */
describe('與課程資料隔離', () => {
  it('存事務不會動到課程那個 key', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, schedules: {} }))
    const before = localStorage.getItem(STORAGE_KEY)

    saveEvents({ '115-1': [newEvent('打工', [slot(3, ['5'])], null)] })

    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('事務壞掉時課表照常讀得出來', () => {
    localStorage.setItem(EVENTS_KEY, '壞掉')

    expect(() => loadStore()).not.toThrow()
    expect(loadStore().schedules).toEqual({})
    expect(localStorage.getItem(EVENTS_BACKUP_KEY)).toBeNull()
  })
})

describe('newEvent', () => {
  it('產生的 id 不會跟課號撞到', () => {
    const event = newEvent('打工', [slot(3, ['5'])], null)

    // 課號是六位數字,事務一律帶前綴 —— 兩邊的 id 永遠不可能相等
    expect(event.id).toMatch(/^evt_/)
    expect(event.id).not.toMatch(/^\d+$/)
  })
})
