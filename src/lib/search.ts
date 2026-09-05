import type { CourseIndexEntry } from '@/types/api'
import { normalize, tokenize } from './normalize'

/**
 * 為什麼不用 Fuse.js / MiniSearch(plan §2.3):
 *
 * 1. 中文沒有空白分詞。模糊比對按字元算編輯距離,對中文會給出大量無關結果
 * 2. 2,717 筆 × 幾個查詢詞的 `indexOf` 在手機上是 10ms 等級。
 *    索引庫解決的是十萬筆以上的問題,我們差兩個數量級
 * 3. 零依賴、行為可預測 —— 打「白敦文」就是找含這三個字的,沒有模糊比對的驚喜
 */

/** 與 sort.ts 同理:共用定序器,避免每次比較都重建。 */
const collator = new Intl.Collator('zh-Hant')

/** 命中位置的權重。數字大小本身沒有意義,只有相對順序有。 */
const SCORE = {
  nameExact: 1000,
  namePrefix: 100,
  nameContains: 50,
  teacher: 30,
  courseId: 20,
  other: 10,
} as const

/** 一門課的正規化索引。各欄位分開存,評分才知道命中在哪裡。 */
export interface SearchDoc {
  id: string
  /** 原始課名,排序時用來穩定同分的順序。 */
  displayName: string
  name: string
  teachers: string
  requirementType: string
  courseId: string
  /** 全欄位串接,用來快速判斷「這個查詢詞有沒有命中任何地方」。 */
  all: string
}

export interface SearchResult {
  id: string
  score: number
}

export function buildIndex(courses: readonly CourseIndexEntry[]): SearchDoc[] {
  return courses.map((c) => {
    const name = normalize(c.name_zh)
    const teachers = normalize(c.teachers.join(''))
    const requirementType = normalize(c.requirement_type)
    const courseId = normalize(c.id)
    return {
      id: c.id,
      displayName: c.name_zh,
      name,
      teachers,
      requirementType,
      courseId,
      all: name + teachers + requirementType + courseId,
    }
  })
}

/** 單一查詢詞在一份文件上的得分;沒命中回傳 0。 */
function scoreToken(doc: SearchDoc, token: string): number {
  if (doc.name === token) return SCORE.nameExact
  if (doc.name.startsWith(token)) return SCORE.namePrefix
  if (doc.name.includes(token)) return SCORE.nameContains
  if (doc.teachers.includes(token)) return SCORE.teacher
  if (doc.courseId.includes(token)) return SCORE.courseId
  if (doc.all.includes(token)) return SCORE.other
  return 0
}

/**
 * 查詢。多個查詢詞**全部命中才算**(AND)。
 *
 * 空查詢回傳全部 —— 只用篩選器不打關鍵字是常見用法,不該回傳空列表。
 */
export function search(docs: readonly SearchDoc[], query: string): SearchResult[] {
  const tokens = tokenize(query)

  if (tokens.length === 0) {
    return docs.map((doc) => ({ id: doc.id, score: 0 }))
  }

  const results: SearchResult[] = []
  for (const doc of docs) {
    let total = 0
    let allMatched = true
    for (const token of tokens) {
      const score = scoreToken(doc, token)
      if (score === 0) {
        allMatched = false
        break
      }
      total += score
    }
    if (allMatched) results.push({ id: doc.id, score: total })
  }

  // 同分時按課名排序,結果才不會因為來源資料的順序而跳動
  const nameById = new Map(docs.map((d) => [d.id, d.displayName]))
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const byName = collator.compare(nameById.get(a.id) ?? '', nameById.get(b.id) ?? '')
    return byName !== 0 ? byName : a.id.localeCompare(b.id)
  })

  return results
}
