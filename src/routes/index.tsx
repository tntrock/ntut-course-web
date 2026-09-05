import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { metaQueryOptions, useMeta } from '@/hooks/useMeta'
import { departmentsQueryOptions } from '@/hooks/useDepartments'
import { collegeGroups } from '@/lib/browse'
import { formatTaipei } from '@/lib/datetime'
import type { Meta } from '@/types/api'

export const Route = createFileRoute('/')({
  /**
   * 先載 `departments.json`(gzip 約 5 KB)。
   *
   * 首頁自己要用它列出校級單位,而且**搜尋頁與瀏覽頁都需要同一份** ——
   * 在這裡取等於順手把下一頁的快取暖起來,不是多花的請求。
   */
  loader: async ({ context }) => {
    const { data: meta } = await context.queryClient.ensureQueryData(metaQueryOptions())
    await context.queryClient.ensureQueryData(
      departmentsQueryOptions(meta, meta.latest),
    )
  },
  component: Home,
})

function Home() {
  const { data: meta } = useMeta()
  const latest = meta.semesters.find((s) => s.path === meta.latest)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">北科課程</h1>
      <p className="text-muted-foreground mt-2">
        查課程、看教學大綱、排課表。非官方網站。
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <ActionCard
          to="/search"
          title="搜尋課程"
          description="關鍵字、系所、時段、學分,條件都留在網址上,可以直接分享。"
          primary
        />
        <ActionCard
          to="/browse"
          title="瀏覽系所與教師"
          description={
            latest
              ? `${latest.department_count} 個系所、${latest.class_group_count} 個班級,還有教師、學程與教室。`
              : '系所、班級、教師、學程與教室。'
          }
        />
      </div>

      <SchoolWideUnits meta={meta} />

      <section className="mt-10">
        <h2 className="text-muted-foreground text-xs font-medium">
          本學期 {meta.latest}
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="課程"
            value={latest ? latest.course_count.toLocaleString('zh-TW') : '—'}
          />
          <Stat label="系所" value={latest ? String(latest.department_count) : '—'} />
          <Stat label="班級" value={latest ? String(latest.class_group_count) : '—'} />
          {/*
            這裡原本放 `merged_course_count`(合開課數),但「其中合開 309」在首頁
            是個沒有上下文就看不懂的數字。換成收錄學期數 —— 那是這個站真正的
            特點,而且看得懂。
          */}
          <Stat label="收錄學期" value={String(meta.semesters.length)} />
        </dl>
      </section>

      <p className="text-muted-foreground mt-8 text-xs">
        資料更新於 {formatTaipei(meta.generated_at)}
      </p>
    </div>
  )
}

function ActionCard({
  to,
  title,
  description,
  primary = false,
}: {
  to: '/search' | '/browse'
  title: string
  description: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={`focus-visible:ring-ring block rounded-xl p-5 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${
        primary
          ? 'bg-primary text-primary-foreground'
          : 'bg-card shadow-card hover:ring-primary/40 hover:ring-1'
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className={`mt-1 text-sm ${primary ? 'opacity-85' : 'text-muted-foreground'}`}>
        {description}
      </p>
    </Link>
  )
}

/**
 * 校級單位 —— 通識、體育這些**每個人都要修**的課在這裡。
 *
 * 這一組不是我挑的,是 `departments.json` 裡 `college` 為 `null` 的那一組
 * (見 `lib/browse.ts`)。學校改了組成,首頁跟著變。
 */
function SchoolWideUnits({ meta }: { meta: Meta }) {
  const departments = useSuspenseQuery(departmentsQueryOptions(meta, meta.latest)).data
  const schoolWide = collegeGroups(departments).find((g) => g.isSchoolWide)

  if (!schoolWide || schoolWide.departments.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-muted-foreground text-xs font-medium">{schoolWide.name}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {schoolWide.departments.map((d) => (
          <Link
            key={d.id}
            to="/dept/$semester/$deptId"
            params={{ semester: meta.latest, deptId: d.id }}
            className="bg-card shadow-card hover:ring-primary/40 focus-visible:ring-ring rounded-lg px-3 py-2 text-sm hover:ring-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            {d.name}
            <span className="text-muted-foreground ml-2 text-xs tabular-nums">
              {d.course_count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card shadow-card rounded-xl p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums">{value}</dd>
    </div>
  )
}
