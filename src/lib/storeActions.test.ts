import { describe, expect, it } from 'vitest'
import { defaultStore } from './storage'
import {
  addToSchedule,
  isFavoriteCourse,
  isFavoriteTeacher,
  isInSchedule,
  refreshSnapshot,
  removeFromSchedule,
  toggleFavoriteCourse,
  toggleFavoriteTeacher,
} from './storeActions'
import { course, slot } from '@/test/factories'

const dip = course({
  id: '364893',
  name_zh: '數位影像處理',
  teacher_codes: ['12095'],
  time_slots: [slot(5, '2', '3', '4')],
  credits: 3,
})

describe('addToSchedule', () => {
  it('把課加進指定學期', () => {
    const store = addToSchedule(defaultStore(), '115-1', dip)

    expect(store.schedules['115-1']?.courses.map((c) => c.id)).toEqual(['364893'])
    expect(store.schedules['115-1']?.courses[0]?.snapshot.name_zh).toBe('數位影像處理')
  })

  it('不會動到原本的 store —— 狀態要能被 React 認出有變', () => {
    const before = defaultStore()
    const after = addToSchedule(before, '115-1', dip)

    expect(before.schedules['115-1']).toBeUndefined()
    expect(after).not.toBe(before)
  })

  it('重複加入同一門課不會變成兩筆', () => {
    const once = addToSchedule(defaultStore(), '115-1', dip)
    const twice = addToSchedule(once, '115-1', dip)

    expect(twice.schedules['115-1']?.courses).toHaveLength(1)
  })

  it('各學期獨立 —— 課號跨學期不通用,不能混在一起', () => {
    let store = addToSchedule(defaultStore(), '115-1', dip)
    store = addToSchedule(store, '114-2', course({ id: '353187' }))

    expect(store.schedules['115-1']?.courses.map((c) => c.id)).toEqual(['364893'])
    expect(store.schedules['114-2']?.courses.map((c) => c.id)).toEqual(['353187'])
  })
})

describe('removeFromSchedule', () => {
  it('只移掉指定的那一門', () => {
    let store = addToSchedule(defaultStore(), '115-1', dip)
    store = addToSchedule(store, '115-1', course({ id: '360744' }))
    store = removeFromSchedule(store, '115-1', '364893')

    expect(store.schedules['115-1']?.courses.map((c) => c.id)).toEqual(['360744'])
  })

  it('移除不存在的課不會壞掉', () => {
    expect(() => removeFromSchedule(defaultStore(), '115-1', '沒有這門')).not.toThrow()
  })
})

describe('isInSchedule', () => {
  it('查得出某門課在不在課表裡', () => {
    const store = addToSchedule(defaultStore(), '115-1', dip)

    expect(isInSchedule(store, '115-1', '364893')).toBe(true)
    expect(isInSchedule(store, '115-1', '360744')).toBe(false)
    // 同一個課號在別的學期不算
    expect(isInSchedule(store, '114-2', '364893')).toBe(false)
  })
})

describe('refreshSnapshot', () => {
  it('用最新資料覆蓋快照,但保留加入時間', () => {
    // 加入時間是使用者的紀錄,不該因為學校改了課而被洗掉
    const store = addToSchedule(defaultStore(), '115-1', dip)
    const addedAt = store.schedules['115-1']?.courses[0]?.addedAt

    const updated = refreshSnapshot(
      store,
      '115-1',
      '364893',
      course({ id: '364893', name_zh: '數位影像處理', credits: 2 }),
    )
    const saved = updated.schedules['115-1']?.courses[0]

    expect(saved?.snapshot.credits).toBe(2)
    expect(saved?.addedAt).toBe(addedAt)
  })

  it('課表裡沒有這門課時什麼也不做', () => {
    const store = defaultStore()

    expect(refreshSnapshot(store, '115-1', '364893', dip)).toEqual(store)
  })
})

describe('收藏', () => {
  it('收藏課程以 學期:課號 為 key,不同學期各自獨立', () => {
    let store = toggleFavoriteCourse(defaultStore(), '115-1', '364893')

    expect(store.favorites.courses).toEqual(['115-1:364893'])
    expect(isFavoriteCourse(store, '115-1', '364893')).toBe(true)
    expect(isFavoriteCourse(store, '114-2', '364893')).toBe(false)

    store = toggleFavoriteCourse(store, '115-1', '364893')
    expect(store.favorites.courses).toEqual([])
  })

  it('追蹤教師用代碼,不是姓名', () => {
    // 803 個代碼只有 801 個姓名 —— 用姓名會同時追蹤到兩位老師
    let store = toggleFavoriteTeacher(defaultStore(), '12095')

    expect(store.favorites.teachers).toEqual(['12095'])
    expect(isFavoriteTeacher(store, '12095')).toBe(true)

    store = toggleFavoriteTeacher(store, '12095')
    expect(store.favorites.teachers).toEqual([])
  })
})
