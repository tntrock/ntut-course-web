import { parseImport, STORE_VERSION, type Store } from './storage'
import { toEventStore, type EventStore } from './events'

/**
 * 匯出 / 匯入的檔案格式。
 *
 * 課程與個人事務在 localStorage 裡是**分開的兩個 key**(理由見 `events.ts`),
 * 但備份檔是一份 —— 使用者要的是「我的東西」,不是兩個檔案。
 *
 * **`version` 維持 `STORE_VERSION`,不因為多了 `events` 而升版。**
 * `parseImport()` 看到比自己新的版本會整包拒收,升版等於讓還沒更新的分頁
 * 連課程都匯入不了,而這個檔案往往是使用者唯一的備份。維持原版本的話,
 * 舊版程式只是忽略它不認得的 `events`,課程照常進去。
 */

export interface Backup extends Store {
  events: EventStore
}

export type BackupResult =
  | { ok: true; store: Store; events: EventStore }
  | { ok: false; reason: 'invalid' | 'unsupported' }

export function serializeBackup(store: Store, events: EventStore): string {
  const backup: Backup = { ...store, version: STORE_VERSION, events }
  return JSON.stringify(backup, null, 2)
}

/**
 * 課程的解析沿用 `parseImport()` —— 版本檢查與寬鬆補值的規則只該有一份。
 *
 * **事務壞掉不會讓整包失敗。** 課表比事務重要,為了一個讀不出來的事務
 * 讓使用者連課都匯不回去,划不來。
 */
export function parseBackup(text: string): BackupResult {
  const result = parseImport(text)
  if (!result.ok) return result

  let events: EventStore = {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && 'events' in parsed) {
      events = toEventStore((parsed as { events: unknown }).events)
    }
  } catch {
    // parseImport 已經過了,這裡不可能失敗 —— 但不值得為此丟例外
  }

  return { ok: true, store: result.store, events }
}
