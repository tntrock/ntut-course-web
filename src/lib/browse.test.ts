import { describe, expect, it } from 'vitest'
import type { Department, DepartmentsResponse } from '@/types/api'
import {
  collegeGroups,
  filterByName,
  groupByInitial,
  isCollegeWideUnit,
} from './browse'

function dept(id: string, name: string, college: string | null): Department {
  return {
    id,
    name,
    college,
    url: `https://aps.ntut.edu.tw/${id}`,
    class_groups: [],
    course_count: 10,
    path: `115-1/courses/${id}.json`,
  }
}

function response(
  departments: Department[],
  colleges: { name: string | null; department_ids: string[] }[],
): DepartmentsResponse {
  return { schema_version: 2, year: 115, sem: 1, departments, colleges }
}

describe('collegeGroups', () => {
  it('college 為 null 的那組顯示成「校級單位」,不能讓 null 跑到畫面上', () => {
    // 實測 115-1 有 5 個:教務處、體育室、通識中心、師培中心、校院級課程
    const data = response(
      [
        dept('01', '教務處', null),
        dept('14', '通識中心', null),
        dept('59', '資工系', '電資學院'),
      ],
      [
        { name: null, department_ids: ['01', '14'] },
        { name: '電資學院', department_ids: ['59'] },
      ],
    )

    const groups = collegeGroups(data)

    expect(groups[0]?.name).toBe('校級單位')
    expect(groups[0]?.isSchoolWide).toBe(true)
    expect(groups[0]?.departments.map((d) => d.name)).toEqual(['教務處', '通識中心'])
    expect(groups[1]?.name).toBe('電資學院')
    expect(groups[1]?.isSchoolWide).toBe(false)
  })

  it('保留資料給的學院順序,不自作主張重排', () => {
    const data = response(
      [dept('59', '資工系', '電資學院'), dept('32', '土木系', '工程學院')],
      [
        { name: '電資學院', department_ids: ['59'] },
        { name: '工程學院', department_ids: ['32'] },
      ],
    )

    expect(collegeGroups(data).map((g) => g.name)).toEqual(['電資學院', '工程學院'])
  })

  it('學院裡列到不存在的系所代碼時跳過,不產生空洞', () => {
    // 陣列裡混進 undefined 會讓渲染直接爆掉
    const data = response(
      [dept('59', '資工系', '電資學院')],
      [{ name: '電資學院', department_ids: ['59', '不存在'] }],
    )

    expect(collegeGroups(data)[0]?.departments).toHaveLength(1)
  })
})

describe('isCollegeWideUnit', () => {
  it('掛在學院底下、自己名字又是「⋯學院」的單位要標出來', () => {
    // C0/C2/C5/C7 掛的是院級共同課程,不是該學院所有系的集合。
    // 不標的話,「機電學院」這個系所會和它上層的「機電學院」標題長得一模一樣
    expect(isCollegeWideUnit(dept('C0', '機電學院', '機電學院'))).toBe(true)
    expect(isCollegeWideUnit(dept('C7', '創新學院', '創新前瞻科技研究學院'))).toBe(true)
  })

  it('一般系所不標', () => {
    expect(isCollegeWideUnit(dept('59', '資工系', '電資學院'))).toBe(false)
    expect(isCollegeWideUnit(dept('91', '科技法律學程', '人文與社會科學學院'))).toBe(
      false,
    )
  })

  it('校級單位不標 —— 它們本來就不在任何學院底下,不會被誤認', () => {
    expect(isCollegeWideUnit(dept('14', '通識中心', null))).toBe(false)
  })
})

describe('groupByInitial', () => {
  const names = (input: string[]) => groupByInitial(input, (n) => n)

  it('按姓名首字分組,組與組之間照定序排', () => {
    // 中文定序是筆畫序:乙(1畫) < 丙(5畫) < 甲(5畫)
    const groups = names(['甲一', '乙二', '甲三'])

    expect(groups.map((g) => g.initial)).toEqual(['乙', '甲'])
    expect(groups[1]?.items).toEqual(['甲一', '甲三'])
  })

  it('組內保留原本的順序', () => {
    expect(names(['林小明', '林大同'])[0]?.items).toEqual(['林小明', '林大同'])
  })

  it('非中文姓名歸到「其他」,不會各自變成一個單獨的字母組', () => {
    // 實測有 2 位:一位英文名,一位名字裡有 Big5 造字(Unicode 私用區)
    const groups = names(['Keerthana K. B.', '紹', '林小明'])
    const other = groups.find((g) => g.initial === '其他')

    expect(other?.items).toHaveLength(2)
    expect(groups.filter((g) => g.initial === '其他')).toHaveLength(1)
  })

  it('「其他」排在最後,不要卡在中文組中間', () => {
    const groups = names(['Keerthana K. B.', '林小明'])

    expect(groups[groups.length - 1]?.initial).toBe('其他')
  })

  it('空名字不會生出一個沒有標題的組', () => {
    expect(names(['', '林小明']).map((g) => g.initial)).toEqual(['林', '其他'])
  })
})

describe('filterByName', () => {
  const items = ['資訊工程系', '電機工程系', 'Keerthana K. B.']
  const find = (q: string) => filterByName(items, (n) => n, q)

  it('查詢字串正規化後比對,全形半形與大小寫都通', () => {
    expect(find('ＫＥＥＲ')).toEqual(['Keerthana K. B.'])
  })

  it('空查詢回傳全部 —— 沒打字不代表什麼都不要', () => {
    expect(find('')).toHaveLength(3)
  })

  it('多個關鍵字要全部命中', () => {
    expect(find('工程 電')).toEqual(['電機工程系'])
  })

  it('查不到就是空陣列,不會退回全部', () => {
    expect(find('不存在的系')).toEqual([])
  })
})
