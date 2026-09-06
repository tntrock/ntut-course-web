import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Count, Empty, type TabProps } from '@/components/browse/TabShared'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { collegeGroups, filterByName, isCollegeWideUnit } from '@/lib/browse'
import type { Department } from '@/types/api'

export function DeptTab({ meta, semester, query }: TabProps) {
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, semester)).data
  const groups = collegeGroups(departments)

  const filtered = groups
    .map((g) => ({
      ...g,
      departments: filterByName(g.departments, (d) => d.name, query),
    }))
    .filter((g) => g.departments.length > 0)

  if (filtered.length === 0) return <Empty what="系所" />

  return (
    <div className="space-y-6">
      {filtered.map((group) => (
        <section key={group.name}>
          <h2 className="text-muted-foreground mb-1 text-xs font-medium">
            {group.name}
          </h2>
          {/* 60 個系所排成一長條要捲很久。寬螢幕分兩欄，一眼看得完一個學院 */}
          <div className="grid gap-2 sm:grid-cols-2">
            {group.departments.map((d) => (
              <DeptRow key={d.id} dept={d} semester={semester} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function DeptRow({ dept, semester }: { dept: Department; semester: string }) {
  return (
    <div className="bg-card shadow-card rounded-xl px-3 py-1">
      <div className="flex items-center gap-3 py-2">
        <Link
          to="/dept/$semester/$deptId"
          params={{ semester, deptId: dept.id }}
          className="flex-1 text-sm underline-offset-4 hover:underline"
        >
          {dept.name}
          {/* C0/C2/C5/C7 掛的是院級共同課程，名字又和上層學院一模一樣。
              不標的話沒有人分得出這是「電資學院的共同課」還是「電資學院所有系」 */}
          {isCollegeWideUnit(dept) && (
            <span className="text-muted-foreground ml-2 text-xs">院級共同課程</span>
          )}
        </Link>
        <Count n={dept.course_count} />
      </div>

      {dept.class_groups.length > 0 && (
        <details className="pb-2">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {dept.class_groups.length} 個班級
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {dept.class_groups.map((c) => (
              <Link
                key={c.id}
                to="/class/$semester/$classId"
                params={{ semester, classId: c.id }}
                className="hover:bg-accent rounded-full border px-2.5 py-1 text-xs"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
