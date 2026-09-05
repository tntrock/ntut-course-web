import { createFileRoute, Link } from '@tanstack/react-router'

import { useMeta } from '@/hooks/useMeta'
import { formatTaipei } from '@/lib/datetime'

export const Route = createFileRoute('/')({
  component: Home,
})

/**
 * 暫時的資料層檢查頁。Phase 1 會換成搜尋框 —— 現在先讓 §4 Phase 0 的驗收條件
 * 在畫面上看得見。
 */
function Home() {
  const { data: meta } = useMeta()
  const latest = meta.semesters.find((s) => s.path === meta.latest)
  const totalCourses = meta.semesters.reduce((sum, s) => sum + s.course_count, 0)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">北科課程</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        查課程、看教學大綱、排課表。非官方網站。
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/search"
          className="bg-primary text-primary-foreground focus-visible:ring-ring inline-block rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          開始搜尋
        </Link>
        <Link
          to="/browse"
          className="hover:bg-accent focus-visible:ring-ring inline-block rounded-lg border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          瀏覽系所與教師
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <Stat label="最新學期" value={meta.latest} />
        <Stat label="收錄學期" value={`${meta.semesters.length} 個`} />
        <Stat label="課程總數" value={totalCourses.toLocaleString('zh-TW')} />
        <Stat
          label="本學期課數"
          value={latest ? latest.course_count.toLocaleString('zh-TW') : '—'}
        />
        <Stat label="資料時間" value={formatTaipei(meta.generated_at)} />
        <Stat label="資料格式版本" value={`v${meta.schema_version}`} />
      </dl>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  )
}
