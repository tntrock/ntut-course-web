import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Count, Empty, type TabProps } from '@/components/browse/TabShared'
import { teachersQueryOptions } from '@/hooks/useBrowse'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { filterByName, groupByInitial } from '@/lib/browse'
import type { TeacherSummary } from '@/types/api'

export function TeacherTab({ meta, semester, query }: TabProps) {
  const teachers = useSuspenseQuery(teachersQueryOptions(meta, semester)).data
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))

  const matched = filterByName(teachers.teachers, (t) => t.name, query)
  if (matched.length === 0) return <Empty what="教師" />

  const groups = groupByInitial(matched, (t) => t.name)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.initial}>
          <h2 className="text-muted-foreground mb-1 text-xs font-medium">
            {group.initial}
          </h2>
          <div className="bg-card shadow-card grid rounded-xl px-3 sm:grid-cols-2 sm:gap-x-4">
            {group.items.map((t) => (
              <TeacherRow
                key={t.id}
                teacher={t}
                semester={semester}
                deptName={deptName}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TeacherRow({
  teacher,
  semester,
  deptName,
}: {
  teacher: TeacherSummary
  semester: string
  deptName: ReadonlyMap<string, string>
}) {
  const depts = teacher.department_ids.map((id) => deptName.get(id) ?? id).join('、')

  return (
    <Link
      to="/teacher/$semester/$teacherId"
      params={{ semester, teacherId: teacher.id }}
      className="hover:bg-muted/40 flex items-center gap-3 border-b px-1 py-2.5"
    >
      <span className="text-sm">{teacher.name}</span>
      {/* 同名老師有兩位（林志哲、陳盈竹）。所屬系所是畫面上唯一分得出誰是誰的線索 */}
      <span className="text-muted-foreground flex-1 truncate text-xs">{depts}</span>
      <Count n={teacher.course_count} />
    </Link>
  )
}
