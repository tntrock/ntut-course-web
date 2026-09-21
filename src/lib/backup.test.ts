import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup } from './backup'
import { defaultStore, STORE_VERSION } from './storage'
import { newEvent } from './events'
import type { TimeSlot } from '@/types/api'

function slot(day: number, periods: string[]): TimeSlot {
  return { day: day as TimeSlot['day'], day_name: '', periods }
}

describe('serializeBackup', () => {
  it('帶著個人事務一起匯出', () => {
    const text = serializeBackup(defaultStore(), {
      '115-1': [newEvent('打工', [slot(3, ['5'])], null)],
    })

    expect(JSON.parse(text).events['115-1'][0].title).toBe('打工')
  })

  /**
   * **版本不能升。**
   *
   * `parseImport()` 看到比自己新的版本會整個拒收。升版等於讓還沒更新的
   * 分頁連課程都匯入不了 —— 而匯出檔常常是使用者唯一的備份。
   * 維持 1 的話舊版只是忽略 `events`,課程照常進去。
   */
  it('版本維持 1,舊版程式才不會整包拒收', () => {
    const text = serializeBackup(defaultStore(), {
      '115-1': [newEvent('打工', [slot(3, ['5'])], null)],
    })

    expect(JSON.parse(text).version).toBe(STORE_VERSION)
  })
})

describe('parseBackup', () => {
  it('還原課程與事務', () => {
    const store = defaultStore()
    store.favorites.courses.push('115-1:364893')
    const text = serializeBackup(store, {
      '115-1': [newEvent('打工', [slot(3, ['5'])], null)],
    })

    const result = parseBackup(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.store.favorites.courses).toEqual(['115-1:364893'])
    expect(result.events['115-1']?.[0]?.title).toBe('打工')
  })

  /** 舊版匯出的檔案沒有 `events`,不該因此讀不了。 */
  it('沒有 events 的舊檔案照常匯入,事務為空', () => {
    const result = parseBackup(JSON.stringify(defaultStore()))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toEqual({})
  })

  it('版本比程式新就明講不支援', () => {
    const result = parseBackup(JSON.stringify({ ...defaultStore(), version: 99 }))

    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('不是 JSON 就說不是本站的檔案', () => {
    expect(parseBackup('不是 JSON')).toEqual({ ok: false, reason: 'invalid' })
  })

  /** 事務壞掉不該讓整包匯入失敗 —— 課表比事務重要。 */
  it('events 壞掉時課程照樣匯入', () => {
    const text = JSON.stringify({ ...defaultStore(), events: '壞掉的內容' })

    const result = parseBackup(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toEqual({})
  })
})
