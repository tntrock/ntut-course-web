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
    courses.map((c) =>
      c.id === courseId ? { ...c, snapshot: toSnapshot(course) } : c,
    ),
  )
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

/** 追蹤教師用**代碼**:803 個代碼只有 801 個姓名(§1.3.6)。 */
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
