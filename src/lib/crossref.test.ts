import { describe, expect, it } from 'vitest'
import { coursesByIds } from './crossref'
import { course } from '@/test/factories'

/**
 * `programs.json` 與 `classrooms.json` **只給課號**,要顯示課程得拿課號回索引查。
 * 實測 115-1 的 1,056 個學程課號與 1,875 個教室課號全部查得到,
 * 但「全部查得到」是這一版資料的狀態,不是 API 的承諾。
 */
describe('coursesByIds', () => {
  const index = [course({ id: '1' }), course({ id: '2' }), course({ id: '3' })]

  it('照課號給的順序回傳', () => {
    expect(coursesByIds(index, ['3', '1']).map((c) => c.id)).toEqual(['3', '1'])
  })

  it('索引裡沒有的課號跳過,不產生 undefined', () => {
    // 陣列裡混進 undefined 會讓渲染直接爆掉
    const found = coursesByIds(index, ['1', '不存在', '2'])

    expect(found.map((c) => c.id)).toEqual(['1', '2'])
    expect(found.every((c) => c !== undefined)).toBe(true)
  })

  it('重複的課號只回傳一次', () => {
    expect(coursesByIds(index, ['1', '1']).map((c) => c.id)).toEqual(['1'])
  })

  it('沒有課號時回傳空陣列', () => {
    expect(coursesByIds(index, [])).toEqual([])
  })
})
