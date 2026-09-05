import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_KEY,
  clearBackup,
  defaultStore,
  loadStore,
  parseImport,
  readBackup,
  saveStore,
  serializeStore,
  STORAGE_KEY,
  STORE_VERSION,
} from './storage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loadStore', () => {
  it('第一次使用時回傳預設值,不是 null', () => {
    const store = loadStore()

    expect(store.version).toBe(STORE_VERSION)
    expect(store.schedules).toEqual({})
    expect(store.favorites.courses).toEqual([])
  })

  it('讀得回自己存進去的內容', () => {
    const store = defaultStore()
    store.favorites.courses.push('115-1:364893')
    saveStore(store)

    expect(loadStore().favorites.courses).toEqual(['115-1:364893'])
  })

  it('內容不是 JSON 時備份原始字串再重置,不靜默丟掉', () => {
    localStorage.setItem(STORAGE_KEY, '{壞掉的內容')

    const store = loadStore()

    expect(store).toEqual(defaultStore())
    // 使用者的資料可能是幾十門課,救不回來也要留著讓人自己撈
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{壞掉的內容')
  })

  it('內容是 JSON 但不是物件時也走備份重置', () => {
    localStorage.setItem(STORAGE_KEY, '"我是字串"')

    expect(loadStore()).toEqual(defaultStore())
    expect(localStorage.getItem(BACKUP_KEY)).toBe('"我是字串"')
  })

  it('版本比程式新時備份後重置 —— 不猜未來的結構', () => {
    // 使用者在新版用過又退回舊版。硬讀可能把不認得的欄位寫壞
    const future = JSON.stringify({ ...defaultStore(), version: STORE_VERSION + 1 })
    localStorage.setItem(STORAGE_KEY, future)

    expect(loadStore().version).toBe(STORE_VERSION)
    expect(localStorage.getItem(BACKUP_KEY)).toBe(future)
  })

  it('個別欄位壞掉時只重置那一塊,其他照留', () => {
    // 整包丟掉太粗暴 —— 課表還在就該留著
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORE_VERSION,
        schedules: { '115-1': { courses: [] } },
        favorites: '這不是物件',
        settings: null,
      }),
    )

    const store = loadStore()

    expect(store.schedules['115-1']).toEqual({ courses: [] })
    expect(store.favorites).toEqual(defaultStore().favorites)
    expect(store.settings).toEqual(defaultStore().settings)
    // 沒有整包丟掉,所以不該產生備份
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('課表裡混進不是課程的東西時,把那一筆濾掉而不是整個學期丟掉', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORE_VERSION,
        schedules: {
          '115-1': {
            courses: [
              {
                id: '364893',
                addedAt: '2026-09-05T10:00:00Z',
                snapshot: { name_zh: '數位影像處理' },
              },
              null,
              { addedAt: '沒有 id' },
            ],
          },
        },
        favorites: defaultStore().favorites,
        settings: defaultStore().settings,
      }),
    )

    const courses = loadStore().schedules['115-1']?.courses

    expect(courses).toHaveLength(1)
    expect(courses?.[0]?.id).toBe('364893')
  })

  it('localStorage 完全不可用時(無痕視窗)回傳預設值,不丟例外', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    })

    expect(() => loadStore()).not.toThrow()
    expect(loadStore()).toEqual(defaultStore())
  })
})

describe('saveStore', () => {
  it('成功時回傳 ok', () => {
    expect(saveStore(defaultStore())).toEqual({ ok: true })
  })

  it('配額用盡時回報 quota,不能假裝存好了', () => {
    // 使用者以為課表存起來了,重新整理後不見 —— 那比直接說存不下更糟
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('exceeded')
      err.name = 'QuotaExceededError'
      throw err
    })

    expect(saveStore(defaultStore())).toEqual({ ok: false, reason: 'quota' })
  })

  it('localStorage 不可用時回報 unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('SecurityError')
      },
    })

    expect(saveStore(defaultStore())).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('匯出與匯入', () => {
  it('匯出再匯入得到一模一樣的內容', () => {
    // 沒有帳號同步,這是換裝置唯一的路 —— 中間掉東西等於資料沒了
    const store = defaultStore()
    store.favorites.courses.push('115-1:364893')
    store.favorites.teachers.push('12095')
    store.schedules['115-1'] = {
      courses: [
        {
          id: '364893',
          addedAt: '2026-09-05T10:00:00Z',
          snapshot: {
            name_zh: '數位影像處理',
            teachers: ['白敦文'],
            teacher_codes: ['12095'],
            time_slots: [{ day: 5, day_name: '五', periods: ['2', '3', '4'] }],
            classrooms: ['六教727(e)'],
            credits: 3,
            required: false,
            requirement_type: '專業選修',
            department_ids: ['59'],
          },
        },
      ],
    }

    const result = parseImport(serializeStore(store))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.store).toEqual(store)
  })

  it('不是 JSON 時說得出是檔案有問題', () => {
    expect(parseImport('這不是 JSON')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('不是物件時也是 invalid', () => {
    expect(parseImport('[1,2,3]')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('版本比程式新時明講不支援,不硬吃', () => {
    // 硬吃會把不認得的欄位寫壞,而使用者手上那個檔案是他唯一的備份
    const future = JSON.stringify({ ...defaultStore(), version: STORE_VERSION + 1 })

    expect(parseImport(future)).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('缺欄位時補上預設值,不整包拒絕', () => {
    const partial = JSON.stringify({
      version: STORE_VERSION,
      favorites: { courses: ['a'] },
    })
    const result = parseImport(partial)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.store.favorites.courses).toEqual(['a'])
      expect(result.store.schedules).toEqual({})
      expect(result.store.settings).toEqual(defaultStore().settings)
    }
  })
})

describe('損毀後的復原', () => {
  it('備份之後要把乾淨的預設值寫回主 key,不能讓壞掉的內容留著', () => {
    // 留著的話每次載入都會重新備份一次,而且使用者永遠處在「壞掉」的狀態
    localStorage.setItem(STORAGE_KEY, '{壞掉的內容')

    loadStore()

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(defaultStore()))
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{壞掉的內容')
  })

  it('讀得到備份,使用者才有機會自己撈回課號', () => {
    localStorage.setItem(STORAGE_KEY, '{壞掉的內容')
    loadStore()

    expect(readBackup()).toBe('{壞掉的內容')
  })

  it('沒有備份時回傳 null', () => {
    expect(readBackup()).toBeNull()
  })

  it('清掉備份之後不再回報', () => {
    localStorage.setItem(STORAGE_KEY, '{壞掉的內容')
    loadStore()

    clearBackup()

    expect(readBackup()).toBeNull()
  })
})
