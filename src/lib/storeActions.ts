import type { CourseIndexEntry, SemesterPath } from '@/types/api'
import type { Store } from './storage'
import { toSnapshot } from './schedule'

/**
 * 個人資料的所有變更都走這裡,而且**一律回傳新的 store**。
 *
 * 就地改寫會讓 React 認不出狀態變了(`useSyncExternalStore` 比的是參考),
 * 畫面不會更新 —— 而使用者會以為按鈕壞了。
 */

/** 收藏課程的 key。**課號跨學期不通用**,所以一定要帶學期。 */
export function favoriteCourseKey(semester: SemesterPath, courseId: string): string {
  return `${semester}:${courseId}`
}

function semesterCourses(store: Store, semester: SemesterPath) {
  return store.schedules[semester]?.courses ?? []
}

function withSchedule(
  store: Store,
  semester: SemesterPath,
  courses: Store['schedules'][string]['courses'],
): Store {
  return {
    ...store,
    schedules: { ...store.schedules, [semester]: { courses } },
  }
}

export function isInSchedule(
  store: Store,
  semester: SemesterPath,
  courseId: string,
): boolean {
  return semesterCourses(store, semester).some((c) => c.id === courseId)
}

export function addToSchedule(
  store: Store,
  semester: SemesterPath,
  course: CourseIndexEntry,
): Store {
  const courses = semesterCourses(store, semester)
  // 重複加入就當作沒事發生 —— 變成兩筆會讓課表自己跟自己衝堂
  if (courses.some((c) => c.id === course.id)) return store

  return withSchedule(store, semester, [
    ...courses,
    {
      id: course.id,
      addedAt: new Date().toISOString(),
      snapshot: toSnapshot(course),
    },
  ])
}

export function removeFromSchedule(
  store: Store,
  semester: SemesterPath,
  courseId: string,
): Store {
  const courses = semesterCourses(store, semester)
  if (!courses.some((c) => c.id === courseId)) return store
  return withSchedule(
    store,
    semester,
    courses.filter((c) => c.id !== courseId),
  )
}

/**
 * 用最新資料覆蓋快照。
 *
 * **保留 `addedAt`** —— 那是使用者自己的紀錄,不該因為學校改了課而被洗掉。
 */
export function refreshSnapshot(
  store: Store,
  semester: SemesterPath,
  courseId: string,
  course: CourseIndexEntry,
): Store {
  const courses = semesterCourses(store, semester)
  if (!courses.some((c) => c.id === courseId)) return store

  return withSchedule(
    store,
    semester,
    courses.map((c) => {
      if (c.id !== courseId) return c
      const next = toSnapshot(course)
      return {
        ...c,
        snapshot: {
          ...next,
          // 更新用的是輕量索引,那裡**沒有 classrooms 這個欄位**。照抄的話
          // 按一下「更新為最新資料」教室就消失了 —— 只有新資料真的帶了教室
          // 才覆蓋,否則留著舊的
          classrooms:
            next.classrooms.length > 0 ? next.classrooms : c.snapshot.classrooms,
        },
      }
    }),
  )
}

/**
 * 快照缺教室的課掛在哪些系所(去重)。
 *
 * `{semester}/index.json` 沒有 `classrooms` 欄位,所以**從搜尋結果加入的課一律
 * 沒有教室**,從詳情頁加入的才有 —— 同一份課表於是有的顯示有的不顯示。
 * 教室只存在系所課程檔裡,要補就得回頭抓那個檔。
 *
 * 只回缺的那些,沒有就回空陣列 —— 不要為了已經齊全的課表發請求。
 */
export function departmentsNeedingClassrooms(
  store: Store,
  semester: SemesterPath,
): string[] {
  const ids = new Set<string>()
  for (const c of semesterCourses(store, semester)) {
    if (c.snapshot.classrooms.length > 0) continue
    const dept = c.snapshot.department_ids[0]
    if (dept !== undefined) ids.add(dept)
  }
  return [...ids]
}

/**
 * 用系所課程檔補上快照的教室。
 *
 * **只補教室,不碰其他欄位。** 這是補救不是「更新為最新資料」—— 順手把學分或
 * 時段一起改掉的話,會把使用者還沒看到的異動提示悄悄蓋掉。
 */
export function fillClassrooms(
  store: Store,
  semester: SemesterPath,
  courses: readonly { id: string; classrooms: readonly string[] }[],
): Store {
  const byId = new Map(courses.map((c) => [c.id, c.classrooms]))
  const saved = semesterCourses(store, semester)
  let changed = false

  const next = saved.map((c) => {
    if (c.snapshot.classrooms.length > 0) return c
    const classrooms = byId.get(c.id)
    if (!classrooms || classrooms.length === 0) return c
    changed = true
    return { ...c, snapshot: { ...c.snapshot, classrooms: [...classrooms] } }
  })

  // 沒有實際變更就回原本的參考,否則 useSyncExternalStore 會讓整頁重繪
  return changed ? withSchedule(store, semester, next) : store
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function isFavoriteCourse(
  store: Store,
  semester: SemesterPath,
  courseId: string,
): boolean {
  return store.favorites.courses.includes(favoriteCourseKey(semester, courseId))
}

export function toggleFavoriteCourse(
  store: Store,
  semester: SemesterPath,
  courseId: string,
): Store {
  return {
    ...store,
    favorites: {
      ...store.favorites,
      courses: toggle(store.favorites.courses, favoriteCourseKey(semester, courseId)),
    },
  }
}

/** 追蹤教師用**代碼**:803 個代碼只有 801 個姓名。 */
export function isFavoriteTeacher(store: Store, teacherCode: string): boolean {
  return store.favorites.teachers.includes(teacherCode)
}

export function toggleFavoriteTeacher(store: Store, teacherCode: string): Store {
  return {
    ...store,
    favorites: {
      ...store.favorites,
      teachers: toggle(store.favorites.teachers, teacherCode),
    },
  }
}
