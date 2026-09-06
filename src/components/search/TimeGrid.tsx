import type { PeriodDef } from '@/types/api'
import { slotKey, type TimeMode } from '@/lib/filters'
import { dayName } from '@/lib/formatTime'

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const
/**
 * 14×7 的時段網格。比「星期下拉 + 節次下拉」好用得多 ——
 * 使用者腦中的空堂就是課表上的格子。
 */
export function TimeGrid({
  periods,
  selected,
  mode,
  onToggle,
  onToggleMode,
  onClear,
}: {
  periods: readonly PeriodDef[]
  selected: readonly string[]
  mode: TimeMode
  onToggle: (key: string) => void
  onToggleMode: (mode: TimeMode) => void
  onClear: () => void
}) {
  const chosen = new Set(selected)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div
          role="radiogroup"
          aria-label="時段比對方式"
          className="bg-muted inline-flex rounded-md p-0.5 text-xs"
        >
          {(
            [
              ['includes', '包含這些時段'],
              ['only', '只在這些時段'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => onToggleMode(value)}
              className={
                mode === value
                  ? 'bg-background rounded px-2 py-1 font-medium shadow-sm'
                  : 'text-muted-foreground rounded px-2 py-1'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            清除 {selected.length} 格
          </button>
        )}
      </div>

      <table className="w-full border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="text-muted-foreground w-6 font-normal" />
            {DAYS.map((day) => (
              <th key={day} className="text-muted-foreground font-normal">
                {dayName(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.code}>
              <th
                scope="row"
                className="text-muted-foreground pr-1 text-right font-normal tabular-nums"
                title={`${period.start}-${period.end}`}
              >
                {period.code}
              </th>
              {DAYS.map((day) => {
                const key = slotKey(day, period.code)
                const isOn = chosen.has(key)
                return (
                  <td key={key} className="p-px">
                    <button
                      type="button"
                      aria-pressed={isOn}
                      aria-label={`週${dayName(day)} 第 ${period.code} 節`}
                      onClick={() => onToggle(key)}
                      className={`focus-visible:ring-ring h-6 w-full rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                        isOn ? 'bg-primary' : 'bg-muted hover:bg-accent'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
