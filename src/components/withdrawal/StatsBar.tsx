import type { WithdrawalStats } from '@/lib/withdrawal'

const pct = (x: number) => `${(x * 100).toFixed(2)}%`
const num = (n: number) => n.toLocaleString('zh-Hant')

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs tabular-nums">{hint}</div>
    </div>
  )
}

/**
 * 統計基準線。
 *
 * **排行榜最容易被讀成黑名單。** 只給名次的話,第一名看起來就像有問題;
 * 附上平均與離散程度,32% 才看得出是極端值、2% 才看得出是常態。
 */
export function StatsBar({
  stats,
  enrolled,
  withdrawn,
  semesters,
  unit,
}: {
  stats: WithdrawalStats
  enrolled: number
  withdrawn: number
  semesters: readonly string[]
  /** 「位教師」或「門課」。 */
  unit: string
}) {
  const base = enrolled + withdrawn
  const overall = base === 0 ? 0 : withdrawn / base
  const span =
    semesters.length === 0
      ? '沒有資料'
      : semesters.length === 1
        ? (semesters[0] ?? '')
        : `${semesters.length} 個學期・${semesters[semesters.length - 1]} – ${semesters[0]}`

  return (
    <div className="bg-card shadow-card mt-4 rounded-xl p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="全校整體"
          value={pct(overall)}
          hint={`撤 ${num(withdrawn)} / ${num(base)} 人次`}
        />
        <Stat label="平均" value={pct(stats.mean)} hint={`標準差 ${pct(stats.sd)}`} />
        <Stat
          label="中位數"
          value={pct(stats.p50)}
          hint={`四分位 ${pct(stats.p25)} – ${pct(stats.p75)}`}
        />
        <Stat label="納入統計" value={`${num(stats.n)} ${unit}`} hint={span} />
      </div>

      {/* 兩個數字不一樣不是算錯。不解釋的話看起來就是矛盾 */}
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        「全校整體」是把所有人次加總後再相除，大班課的影響比較大；「平均」是每一{unit}
        各算一個比率再平均，小班課和大班課一樣重。
      </p>
    </div>
  )
}
