import { describe, expect, it } from 'vitest'
import { buildIndex, search } from './search'
import { course } from '@/test/factories'

const courses = [
  course({ id: '364893', name_zh: '數位影像處理', teachers: ['白敦文'] }),
  course({ id: '364899', name_zh: '數位影像處理專題', teachers: ['白敦文'] }),
  course({ id: '361000', name_zh: '影像處理概論', teachers: ['王小明'] }),
  course({ id: '362000', name_zh: '工程數學（一）', teachers: ['李四'] }),
  course({ id: '363000', name_zh: '工程數學(二)', teachers: ['李四'] }),
  course({ id: '365000', name_zh: '機器學習', teachers: ['白敦文'] }),
]

const index = buildIndex(courses)
const ids = (query: string) => search(index, query).map((r) => r.id)

describe('search', () => {
  it('查教師姓名找得到他所有的課', () => {
    expect(ids('白敦文').sort()).toEqual(['364893', '364899', '365000'])
  })

  it('課名完全相等排在只是包含的前面', () => {
    const result = ids('數位影像處理')

    expect(result[0]).toBe('364893')
    expect(result).toContain('364899')
  })

  it('課名開頭命中排在中間命中的前面', () => {
    const result = ids('影像')

    // 「影像處理概論」以「影像」開頭,排在「數位影像處理」前面
    expect(result[0]).toBe('361000')
  })

  it('查課號找得到那門課', () => {
    expect(ids('364893')).toEqual(['364893'])
  })

  it('多個查詢詞必須全部命中(AND,不是 OR)', () => {
    // 「白敦文」有 3 門,其中只有 1 門課名含「機器」
    expect(ids('白敦文 機器')).toEqual(['365000'])
  })

  it('任一查詢詞沒命中就整筆排除', () => {
    expect(ids('白敦文 不存在的東西')).toEqual([])
  })

  it('全形與半形括號互通', () => {
    // 資料裡兩種寫法都有,使用者打哪一種都要兩門都找到
    expect(ids('工程數學(一)')).toContain('362000')
    expect(ids('工程數學（二）')).toContain('363000')
  })

  it('空查詢回傳全部,讓只用篩選器也能列出結果', () => {
    expect(ids('')).toHaveLength(courses.length)
    expect(ids('   ')).toHaveLength(courses.length)
  })

  it('同分時的順序穩定,不會因為資料順序而跳動', () => {
    const forward = search(buildIndex(courses), '李四').map((r) => r.id)
    const reversed = search(buildIndex([...courses].reverse()), '李四').map((r) => r.id)

    expect(forward).toEqual(reversed)
  })

  it('大小寫不影響結果', () => {
    const upper = buildIndex([course({ id: '1', name_zh: 'Machine Learning' })])

    expect(search(upper, 'machine').map((r) => r.id)).toEqual(['1'])
    expect(search(upper, 'MACHINE').map((r) => r.id)).toEqual(['1'])
  })

  it('沒有教師的課(teachers 為空)不會讓建索引失敗', () => {
    const withoutTeacher = buildIndex([
      course({ id: '1', name_zh: '班週會', teachers: [] }),
    ])

    expect(search(withoutTeacher, '班週會').map((r) => r.id)).toEqual(['1'])
  })

  it('課名命中的分數高於教師姓名命中', () => {
    const mixed = buildIndex([
      course({ id: 'byName', name_zh: '白敦文紀念講座', teachers: [] }),
      course({ id: 'byTeacher', name_zh: '無關課程', teachers: ['白敦文'] }),
    ])

    expect(search(mixed, '白敦文').map((r) => r.id)).toEqual(['byName', 'byTeacher'])
  })
})
