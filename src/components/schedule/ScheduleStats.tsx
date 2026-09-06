import type { scheduleStats } from '@/lib/schedule'

export function ScheduleStats({ stats }: { stats: ReturnType<typeof scheduleStats> }) {
  return (
    <section className="mt-6">
      <h2 className="text-muted-foreground text-xs font-medium">統計</h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="總學分" value={String(stats.totalCredits)} />
        <Stat label="必修" value={String(stats.requiredCredits)} />
        <Stat label="選修" value={String(stats.electiveCredits)} />
        <Stat label="門數" value={String(stats.courseCount)} />
      </dl>

      {/* 這兩種課會讓總學分看起來不對，不講清楚使用者會以為程式壞了 */}
      {stats.unclassifiedCredits > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          另有 {stats.unclassifiedCredits} 學分的課沒有標示必選修，未計入上面兩欄。
        </p>
      )}
      {stats.unknownCreditCount > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          {stats.unknownCreditCount} 門課沒有提供學分數，未計入總學分。
        </p>
      )}
      {stats.earliest && stats.latest && (
        <p className="text-muted-foreground mt-1 text-xs">
          最早第 {stats.earliest} 節，最晚第 {stats.latest} 節。
        </p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card shadow-card rounded-xl p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-xl font-medium tabular-nums">{value}</dd>
    </div>
  )
}
