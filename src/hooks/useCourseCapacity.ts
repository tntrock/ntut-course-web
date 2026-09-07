import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { capacityQueryOptions, classroomsQueryOptions } from '@/hooks/useBrowse'
import { courseCapacity } from '@/lib/rooms'
import type { Meta, SemesterPath } from '@/types/api'

/**
 * 課號 → 教室容量,給課程卡片用。
 *
 * **在清單層算一次,不要每張卡片各算一次。** 反轉 231 間教室要跑過幾千個課號,
 * 虛擬捲動下同時有三十張卡片,各自算就是三十遍。
 *
 * 兩支查詢都不用 suspense —— 容量只是卡片上的一個小徽章,為了它讓整頁空白
 * 不划算。還沒到就先不顯示。
 */
export function useCourseCapacity(
  meta: Meta,
  semester: SemesterPath,
): ReadonlyMap<string, number> {
  const classrooms = useQuery(classroomsQueryOptions(meta, semester)).data
  const capacity = useQuery(capacityQueryOptions(meta)).data

  return useMemo(() => {
    if (!classrooms || !capacity) return new Map<string, number>()
    const seats = new Map(
      Object.entries(capacity.classrooms).map(([id, c]) => [id, c.capacity]),
    )
    return courseCapacity(classrooms.classrooms, seats)
  }, [classrooms, capacity])
}
