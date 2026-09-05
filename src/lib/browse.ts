import type { Department, DepartmentsResponse } from '@/types/api'
import { normalize, tokenize } from './normalize'

/** 與 sort.ts / search.ts 同理:共用定序器,避免每次比較都重建。 */
const collator = new Intl.Collator('zh-Hant')

/** 不屬於任何學院的單位。**畫面上絕不能出現 `null` 或空標題。** */
export const SCHOOL_WIDE = '校級單位'

/** 首字不是中文的姓名歸在這一組。 */
export const OTHER_INITIAL = '其他'

export interface CollegeGroup {
  name: string
  /** 這一組是「校級單位」而非真正的學院。 */
  isSchoolWide: boolean
  departments: Department[]
}

/**
 * 把系所照學院分組。
 *
 * `departments.json` 的 `colleges[]` 已經分好了,這裡只做兩件事:
 * 把 `null` 的組名換成看得懂的字,以及把代碼換成系所物件。
 *
 * **順序照資料給的,不重排** —— 那是學校自己的順序,我們沒有更好的依據。
 */
export function collegeGroups(data: DepartmentsResponse): CollegeGroup[] {
  const byId = new Map(data.departments.map((d) => [d.id, d]))

  return data.colleges.map((college) => ({
    name: college.name ?? SCHOOL_WIDE,
    isSchoolWide: college.name === null,
    // 代碼對不到系所時跳過 —— 陣列裡混進 undefined 會讓渲染直接爆掉
    departments: college.department_ids
      .map((id) => byId.get(id))
      .filter((d) => d !== undefined),
  }))
}

/**
 * 這個單位掛的是**院級共同課程**,不是該學院所有系的集合。
 *
 * 實測 `C0` `C2` `C5` `C7` 四個:它們自己的名字就叫「機電學院」「管理學院」…,
 * 和上層的學院標題長得一模一樣,不標註的話沒有人分得出差別。
 *
 * 判斷用資料的形狀(在學院底下、自己又叫「⋯學院」)而不是寫死那四個代碼 ——
 * 學校加第五個時不必改程式。
 */
export function isCollegeWideUnit(dept: Department): boolean {
  return dept.college !== null && dept.name.endsWith('學院')
}

export interface InitialGroup<T> {
  initial: string
  items: T[]
}

/** 中日韓統一表意文字。私用區(Big5 造字)與拉丁字母都不算。 */
function isHan(char: string): boolean {
  return /\p{Script=Han}/u.test(char)
}

/**
 * 按姓名首字分組。803 位教師一次列出來沒人找得到。
 *
 * 首字不是中文的一律歸「其他」並排在最後 —— 實測只有 2 位(一位英文名,
 * 一位名字裡有 Big5 造字),讓它們各自佔一個組標題只是噪音。
 */
export function groupByInitial<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
): InitialGroup<T>[] {
  const buckets = new Map<string, T[]>()

  for (const item of items) {
    const name = nameOf(item)
    const first = name.charAt(0)
    const key = first !== '' && isHan(first) ? first : OTHER_INITIAL
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const other = buckets.get(OTHER_INITIAL)
  buckets.delete(OTHER_INITIAL)

  const groups = [...buckets.entries()]
    .map(([initial, groupItems]) => ({ initial, items: groupItems }))
    .sort((a, b) => collator.compare(a.initial, b.initial))

  if (other) groups.push({ initial: OTHER_INITIAL, items: other })
  return groups
}

/**
 * 依名稱篩選。與搜尋頁共用同一套正規化,全形半形、大小寫、標點都不影響比對。
 *
 * 多個關鍵字要**全部**命中(AND),與 `lib/search.ts` 的規則一致。
 */
export function filterByName<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  query: string,
): T[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return [...items]

  return items.filter((item) => {
    const name = normalize(nameOf(item))
    return tokens.every((token) => name.includes(token))
  })
}
