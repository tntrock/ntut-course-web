import type { Filters } from './filters'

/**
 * 可以被建議移除的條件。學分的上下限算同一個 —— 只移除其中一邊沒有意義。
 */
export type RelaxTarget =
  | 'query'
  | 'departments'
  | 'requirementTypes'
  | 'languages'
  | 'slots'
  | 'credits'
  | 'teacherCode'
  | 'classId'
  | 'courseIdSet'

export interface Relaxation {
  remove: RelaxTarget
  /** 移除這個條件後會有幾筆結果。 */
  count: number
}

interface Candidate {
  target: RelaxTarget
  isActive: (f: Filters) => boolean
  without: (f: Filters) => Filters
}

const CANDIDATES: Candidate[] = [
  {
    target: 'departments',
    isActive: (f) => f.departments.length > 0,
    without: (f) => ({ ...f, departments: [] }),
  },
  {
    target: 'requirementTypes',
    isActive: (f) => f.requirementTypes.length > 0,
    without: (f) => ({ ...f, requirementTypes: [] }),
  },
  {
    target: 'languages',
    isActive: (f) => f.languages.length > 0,
    without: (f) => ({ ...f, languages: [] }),
  },
  {
    target: 'slots',
    isActive: (f) => f.slots.length > 0,
    without: (f) => ({ ...f, slots: [] }),
  },
  {
    target: 'credits',
    isActive: (f) => f.creditsMin !== null || f.creditsMax !== null,
    without: (f) => ({ ...f, creditsMin: null, creditsMax: null }),
  },
  {
    target: 'teacherCode',
    isActive: (f) => f.teacherCode !== null,
    without: (f) => ({ ...f, teacherCode: null }),
  },
  {
    target: 'classId',
    isActive: (f) => f.classId !== null,
    without: (f) => ({ ...f, classId: null }),
  },
  {
    target: 'courseIdSet',
    isActive: (f) => f.courseIdSet !== null,
    without: (f) => ({ ...f, courseIdSet: null }),
  },
]

/**
 * 沒有結果時,算出「移除哪一個條件會有結果」。
 *
 * 逐一移除**單一**條件重跑,回傳有結果的選項,依結果數由多到少排序。
 * 空結果頁只丟一句「找不到」等於把問題丟回給使用者 —— 他通常不知道是哪個
 * 條件卡住的,尤其時段格子這種點了很多下的條件。
 *
 * @param countMatches 給定關鍵字與條件,回傳結果數。由呼叫端注入,
 *                     這個函式本身不碰資料,所以測試不需要準備課程。
 */
export function suggestRelaxations(
  countMatches: (query: string, filters: Filters) => number,
  query: string,
  filters: Filters,
): Relaxation[] {
  const out: Relaxation[] = []

  if (query.trim() !== '') {
    const count = countMatches('', filters)
    if (count > 0) out.push({ remove: 'query', count })
  }

  for (const candidate of CANDIDATES) {
    if (!candidate.isActive(filters)) continue
    const count = countMatches(query, candidate.without(filters))
    if (count > 0) out.push({ remove: candidate.target, count })
  }

  return out.sort((a, b) => b.count - a.count)
}

/** 給 UI 用的中文說明。 */
export const RELAX_LABELS: Record<RelaxTarget, string> = {
  query: '關鍵字',
  departments: '系所',
  requirementTypes: '必選修',
  languages: '授課語言',
  slots: '時段',
  credits: '學分範圍',
  teacherCode: '教師',
  classId: '班級',
  courseIdSet: '學程 / 教室',
}
