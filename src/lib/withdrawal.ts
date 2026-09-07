import type { CourseIndexEntry } from '@/types/api'

/**
 * 退選率。
 *
 * **分母是「人 + 撤」。** 原始頁面的「人」是**目前**選課人數（撤選的已經扣掉），
 * 「撤」是目前退選人數 —— 所以原始修課人次要把撤選的加回來。
 *
 * 用「撤 / 人」會系統性高估：某門課撤 17、現存 30，`撤/(人+撤)` 是 36.2%，
 * `撤/人` 卻是 56.7%。
 *
 * ⚠️ **退選率高不等於老師教得差。** 可能是擋修的必修、時段很爛、或課本身就難。
 * 畫面上一定要把原始人次擺在比率旁邊，讓讀者自己判斷樣本大小。
 */
export function withdrawalRate(
  enrolled: number | null,
  withdrawn: number | null,
): number {
  const w = withdrawn ?? 0
  const base = (enrolled ?? 0) + w
  return base === 0 ? 0 : w / base
}

interface Stats {
  /** 目前選課人數。 */
  enrolled: number
  withdrawn: number
  /** 原始修課人次（人 + 撤），也是判斷樣本大小的依據。 */
  base: number
  rate: number
}

export interface CourseWithdrawal extends Stats {
  id: string
  name: string
  teachers: string[]
  teacherCodes: string[]
}

export interface TeacherWithdrawal extends Stats {
  code: string
  name: string
  courseCount: number
}

function stats(enrolled: number, withdrawn: number): Stats {
  return {
    enrolled,
    withdrawn,
    base: enrolled + withdrawn,
    rate: withdrawalRate(enrolled, withdrawn),
  }
}

/** 比率由高到低；同比率時撤選人數多的在前，順序才穩定。 */
function byRate<T extends Stats>(a: T, b: T): number {
  return b.rate - a.rate || b.withdrawn - a.withdrawn
}

/**
 * 逐課的退選率。
 *
 * `minBase` 擋掉小樣本 —— 「3 人修、2 人撤 = 40%」不是訊號。不擋的話榜首永遠是
 * 這種課，真正值得看的大班課反而被擠掉。
 */
export function courseWithdrawals(
  courses: readonly CourseIndexEntry[],
  minBase: number,
): CourseWithdrawal[] {
  return (
    courses
      .map((c) => ({
        id: c.id,
        name: c.name_zh,
        teachers: c.teachers,
        teacherCodes: c.teacher_codes,
        ...stats(c.enrolled ?? 0, c.withdrawn ?? 0),
      }))
      // 沒有人撤選的課列出來只是佔位子
      .filter((c) => c.withdrawn > 0 && c.base >= minBase)
      .sort(byRate)
  )
}

/**
 * 依教師彙總的退選率。
 *
 * **以代碼彙總,不是姓名** —— 實測有同名老師,用姓名會把兩個人的課混在一起。
 *
 * 合開的課無法把人數拆給個別老師,所以每一位都記整份。比率仍然正確（分子分母
 * 一起放大），但「幾門課」會是各自的實際授課數。
 */
export function teacherWithdrawals(
  courses: readonly CourseIndexEntry[],
  names: ReadonlyMap<string, string>,
  minBase: number,
): TeacherWithdrawal[] {
  const agg = new Map<string, { enrolled: number; withdrawn: number; count: number }>()

  for (const c of courses) {
    for (const code of c.teacher_codes) {
      const a = agg.get(code) ?? { enrolled: 0, withdrawn: 0, count: 0 }
      a.enrolled += c.enrolled ?? 0
      a.withdrawn += c.withdrawn ?? 0
      a.count += 1
      agg.set(code, a)
    }
  }

  return [...agg]
    .map(([code, a]) => ({
      code,
      // 查不到姓名時顯示代碼,不要留空白
      name: names.get(code) ?? code,
      courseCount: a.count,
      ...stats(a.enrolled, a.withdrawn),
    }))
    .filter((t) => t.withdrawn > 0 && t.base >= minBase)
    .sort(byRate)
}
