import { describe, expect, it } from 'vitest'
import { defaultStore } from './storage'
import {
  addToSchedule,
  departmentsNeedingClassrooms,
  fillClassrooms,
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

describe('教室的補救', () => {
  /** 搜尋卡片傳的是輕量索引 —— 那裡**沒有 classrooms 這個欄位**。 */
  const fromIndex = course({ id: '364893', name_zh: '數位影像處理' })
  /** 詳情頁傳的是系所課程檔的完整物件。 */
  const full = { ...fromIndex, classrooms: ['六教727(e)'] }

  it('refreshSnapshot 不會把既有的教室洗掉', () => {
    // 更新用的是輕量索引,那裡沒有教室。照抄的話按一下「更新為最新資料」
    // 教室就消失了 —— 使用者只會覺得資料越更新越少
    const saved = addToSchedule(defaultStore(), '115-1', full)
    expect(saved.schedules['115-1']?.courses[0]?.snapshot.classrooms).toEqual([
      '六教727(e)',
    ])

    const after = refreshSnapshot(saved, '115-1', '364893', fromIndex)
    expect(after.schedules['115-1']?.courses[0]?.snapshot.classrooms).toEqual([
      '六教727(e)',
    ])
  })

  it('新資料有教室時以新的為準', () => {
    const saved = addToSchedule(defaultStore(), '115-1', full)
    const moved = { ...fromIndex, classrooms: ['三教501'] }

    const after = refreshSnapshot(saved, '115-1', '364893', moved)
    expect(after.schedules['115-1']?.courses[0]?.snapshot.classrooms).toEqual([
      '三教501',
    ])
  })

  it('列出缺教室的課掛在哪些系所', () => {
    // 只有缺的才要抓,而且同一個系所只抓一次
    let store = addToSchedule(defaultStore(), '115-1', fromIndex)
    store = addToSchedule(store, '115-1', course({ id: 'B', department_ids: ['59'] }))
    const hasRoom = {
      ...course({ id: 'C', department_ids: ['01'] }),
      classrooms: ['已經有了'],
    }
    store = addToSchedule(store, '115-1', hasRoom)

    expect(departmentsNeedingClassrooms(store, '115-1')).toEqual(['59'])
  })

  it('沒有課缺教室時回空陣列,不要發沒必要的請求', () => {
    const store = addToSchedule(defaultStore(), '115-1', full)
    expect(departmentsNeedingClassrooms(store, '115-1')).toEqual([])
  })

  it('用系所課程檔補上教室', () => {
    const store = addToSchedule(defaultStore(), '115-1', fromIndex)
    const withRoom = { ...fromIndex, classrooms: ['六教727(e)'] }
    const after = fillClassrooms(store, '115-1', [withRoom])

    expect(after.schedules['115-1']?.courses[0]?.snapshot.classrooms).toEqual([
      '六教727(e)',
    ])
  })

  it('補不到的課保持原樣,而且 store 參考不變', () => {
    // 沒有實際變更卻回傳新物件的話,useSyncExternalStore 會讓整頁重繪
    const store = addToSchedule(defaultStore(), '115-1', fromIndex)
    expect(fillClassrooms(store, '115-1', [])).toBe(store)
  })

  it('只補教室,不動快照的其他欄位', () => {
    // 這支是補救,不是「更新為最新資料」。悄悄改掉學分或時段會蓋掉異動提示
    const store = addToSchedule(defaultStore(), '115-1', fromIndex)
    const changedElsewhere = {
      ...fromIndex,
      name_zh: '改過的名字',
      credits: 99,
      classrooms: ['六教727'],
    }
    const after = fillClassrooms(store, '115-1', [changedElsewhere])

    const snap = after.schedules['115-1']?.courses[0]?.snapshot
    expect(snap?.classrooms).toEqual(['六教727'])
    expect(snap?.name_zh).toBe('數位影像處理')
    expect(snap?.credits).toBe(fromIndex.credits)
  })
})
