import { useSuspenseQuery } from '@tanstack/react-query'

import { Empty, NameCountList, type TabProps } from '@/components/browse/TabShared'
import { classroomsQueryOptions } from '@/hooks/useBrowse'
import { filterByName } from '@/lib/browse'

export function ClassroomTab({ meta, semester, query }: TabProps) {
  const classrooms = useSuspenseQuery(classroomsQueryOptions(meta, semester)).data
  const matched = filterByName(classrooms.classrooms, (c) => c.name, query)

  if (matched.length === 0) return <Empty what="教室" />

  return (
    <NameCountList
      items={matched.map((c) => ({
        key: c.id,
        name: c.name,
        count: c.course_count,
        to: '/classroom/$semester/$classroomId',
        params: { semester, classroomId: c.id },
      }))}
    />
  )
}
