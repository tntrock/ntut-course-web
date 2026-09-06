import { useSuspenseQuery } from '@tanstack/react-query'

import { Empty, NameCountList, type TabProps } from '@/components/browse/TabShared'
import { programsQueryOptions } from '@/hooks/useBrowse'
import { filterByName } from '@/lib/browse'

export function ProgramTab({ meta, semester, query }: TabProps) {
  const programs = useSuspenseQuery(programsQueryOptions(meta, semester)).data
  const matched = filterByName(programs.programs, (p) => p.name, query)

  if (matched.length === 0) return <Empty what="學程" />

  return (
    <NameCountList
      items={matched.map((p) => ({
        // 學程沒有代碼,名稱就是識別
        key: p.name,
        name: p.name,
        count: p.course_count,
        to: '/program/$semester/$programName',
        params: { semester, programName: p.name },
      }))}
    />
  )
}
