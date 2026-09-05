import type { SemesterPath, TimeSlot } from '@/types/api'

/**
 * 個人資料的儲存層。
 *
 * 這是全站**唯一會寫入使用者資料**的地方,所以有兩條硬規則:
 *
 * 1. **`loadStore()` 永遠不丟例外、永遠回傳可用的結構。** 讀不到、壞掉、
 *    版本不對都一樣 —— 個人資料出問題不該讓整個網站變成白畫面。
 * 2. **絕不靜默丟掉資料。** 整包救不回來時先原樣備份到 `BACKUP_KEY` 再重置,
 *    使用者至少還能自己撈出課號。
 */

export const STORAGE_KEY = 'ntut-course-web:v1'
export const BACKUP_KEY = 'ntut-course-web:v1.backup'
export const STORE_VERSION = 1

/**
 * 課程快照。**存快照而不只存課號**的兩個理由(plan §2.5):
 *
 * 1. 離線時直接拿來畫課表,不需要任何請求
 * 2. 連上線後與最新資料比對,課被停開、調課、換老師、改學分都能標出來
 */
export interface CourseSnapshot {
  name_zh: string
  teachers: string[]
  teacher_codes: string[]
  time_slots: TimeSlot[]
  classrooms: string[]
  credits: number | null
  /** 三態:`null` 是原始欄位空白,不是「不是必修」。 */
  required: boolean | null
  requirement_type: string | null
  department_ids: string[]
}

export interface SavedCourse {
  id: string
  addedAt: string
  snapshot: CourseSnapshot
}

export interface Store {
  version: number
  /** 各學期獨立。**課號跨學期不通用,所以不做遷移**(plan §7 風險 6)。 */
  schedules: Record<SemesterPath, { courses: SavedCourse[] }>
  favorites: {
    /** `{semester}:{courseId}`。 */
    courses: string[]
    /** 教師**代碼**,不是姓名(§1.3.6)。 */
    teachers: string[]
  }
  settings: { theme: 'system' | 'light' | 'dark'; showWeekend: boolean }
}

export function defaultStore(): Store {
  return {
    version: STORE_VERSION,
    schedules: {},
    favorites: { courses: [], teachers: [] },
    settings: { theme: 'system', showWeekend: false },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

/** 快照缺欄位時補預設值 —— 舊版本存的資料可能少欄位,不該因此整筆丟掉。 */
function toSnapshot(value: unknown): CourseSnapshot {
  const raw = isRecord(value) ? value : {}
  return {
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : '',
    teachers: strings(raw.teachers),
    teacher_codes: strings(raw.teacher_codes),
    time_slots: Array.isArray(raw.time_slots) ? (raw.time_slots as TimeSlot[]) : [],
    classrooms: strings(raw.classrooms),
    credits: typeof raw.credits === 'number' ? raw.credits : null,
    required: typeof raw.required === 'boolean' ? raw.required : null,
    requirement_type:
      typeof raw.requirement_type === 'string' ? raw.requirement_type : null,
    department_ids: strings(raw.department_ids),
  }
}

/** 沒有 `id` 的項目沒救,直接濾掉 —— 但不牽連同一學期的其他課。 */
function toSavedCourses(value: unknown): SavedCourse[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '') return []
    return [
      {
        id: item.id,
        addedAt: typeof item.addedAt === 'string' ? item.addedAt : '',
        snapshot: toSnapshot(item.snapshot),
      },
    ]
  })
}

function toSchedules(value: unknown): Store['schedules'] {
  if (!isRecord(value)) return {}
  const out: Store['schedules'] = {}
  for (const [semester, entry] of Object.entries(value)) {
    out[semester] = {
      courses: toSavedCourses(isRecord(entry) ? entry.courses : undefined),
    }
  }
  return out
}

function toFavorites(value: unknown): Store['favorites'] {
  if (!isRecord(value)) return defaultStore().favorites
  return { courses: strings(value.courses), teachers: strings(value.teachers) }
}

function toSettings(value: unknown): Store['settings'] {
  const fallback = defaultStore().settings
  if (!isRecord(value)) return fallback
  const theme = value.theme
  return {
    theme:
      theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme
        : fallback.theme,
    showWeekend:
      typeof value.showWeekend === 'boolean' ? value.showWeekend : fallback.showWeekend,
  }
}

/**
 * 讀不到就當作沒有。
 *
 * 無痕視窗、瀏覽器停用網站資料、企業政策都會讓 `localStorage` 直接丟例外 ——
 * 那時整個站要照常運作,只是存不下東西。
 */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * 整包救不回來時的最後手段:原樣留一份,再回到乾淨狀態。
 *
 * **「重置」要真的寫回去。** 只備份不覆蓋的話,壞掉的內容會一直留在主 key,
 * 每次載入都重新備份一次,而且使用者永遠停在「壞掉」的狀態。
 */
function backupAndReset(raw: string): Store {
  writeRaw(BACKUP_KEY, raw)
  const fresh = defaultStore()
  writeRaw(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

/**
 * 讀出上一次損毀時留下的原始內容。
 *
 * UI 要拿它告訴使用者「你的資料讀不出來,但還留著」—— 課表默默變空而沒有任何
 * 說明,使用者只會以為網站弄丟了他的東西。
 */
export function readBackup(): string | null {
  return readRaw(BACKUP_KEY)
}

/** 使用者確認過(或下載過)之後清掉,提示才不會一直跟著他。 */
export function clearBackup(): void {
  try {
    localStorage.removeItem(BACKUP_KEY)
  } catch {
    // 存不了也刪不了,那就讓提示留著 —— 總比丟例外好
  }
}

export function loadStore(): Store {
  const raw = readRaw(STORAGE_KEY)
  if (raw === null) return defaultStore()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return backupAndReset(raw)
  }

  if (!isRecord(parsed)) return backupAndReset(raw)

  const version = typeof parsed.version === 'number' ? parsed.version : 0

  // 比程式新的版本不猜結構 —— 使用者可能在新版用過又退回舊版,
  // 硬讀會把不認得的欄位寫壞。備份起來,等他們換回新版就還在
  if (version > STORE_VERSION) return backupAndReset(raw)

  // version < STORE_VERSION 時未來要在這裡接遷移函式。
  // 目前只有 v1,所以下面的寬鬆解析本身就足以吃下任何舊結構。

  return {
    version: STORE_VERSION,
    schedules: toSchedules(parsed.schedules),
    favorites: toFavorites(parsed.favorites),
    settings: toSettings(parsed.settings),
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' }

/**
 * 寫入結果要回報,不能假裝存好了。
 *
 * 使用者以為課表存起來了、重新整理後不見 —— 那比當下就說「存不下」更糟。
 */
export function saveStore(store: Store): SaveResult {
  let serialized: string
  try {
    serialized = JSON.stringify(store)
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  try {
    localStorage.setItem(STORAGE_KEY, serialized)
    return { ok: true }
  } catch (error) {
    const quota =
      error instanceof Error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return { ok: false, reason: quota ? 'quota' : 'unavailable' }
  }
}

/**
 * 匯出成人看得懂的 JSON。
 *
 * 沒有帳號同步,這個檔案是換裝置唯一的路(plan §7 風險 7),所以縮排排版 ——
 * 使用者要能自己打開來確認裡面有什麼。
 */
export function serializeStore(store: Store): string {
  return JSON.stringify(store, null, 2)
}

export type ImportResult =
  { ok: true; store: Store } | { ok: false; reason: 'invalid' | 'unsupported' }

/**
 * 解析匯入的檔案。
 *
 * 缺欄位補預設值(舊版匯出的檔案可能少東西),但**版本比程式新就明講不支援** ——
 * 硬吃會把不認得的欄位寫壞,而使用者手上那個檔案很可能是他唯一的備份。
 */
export function parseImport(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (!isRecord(parsed)) return { ok: false, reason: 'invalid' }

  const version = typeof parsed.version === 'number' ? parsed.version : 0
  if (version > STORE_VERSION) return { ok: false, reason: 'unsupported' }

  return {
    ok: true,
    store: {
      version: STORE_VERSION,
      schedules: toSchedules(parsed.schedules),
      favorites: toFavorites(parsed.favorites),
      settings: toSettings(parsed.settings),
    },
  }
}
