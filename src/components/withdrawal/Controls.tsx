import { RANGE_LABELS, RANGES, type Range } from '@/hooks/useWithdrawal'
import {
  GROUP_LABELS,
  GROUPINGS,
  MIN_OPTIONS,
  SORT_LABELS,
  SORTS,
  type Grouping,
  type Sort,
} from '@/lib/withdrawal'

function Select<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <label className="text-muted-foreground text-xs">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-card text-foreground rounded-lg border px-2 py-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Controls({
  range,
  sort,
  grouping,
  min,
  query,
  unit,
  onChange,
  onQuery,
}: {
  range: Range
  sort: Sort
  grouping: Grouping
  min: number
  query: string
  unit: string
  onChange: (patch: {
    range?: Range
    sort?: Sort
    group?: Grouping
    min?: number
  }) => void
  onQuery: (value: string) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Select
          label="期間"
          value={range}
          options={RANGES}
          labels={RANGE_LABELS}
          onChange={(range) => onChange({ range })}
        />
        <Select
          label="排序"
          value={sort}
          options={SORTS}
          labels={SORT_LABELS}
          onChange={(sort) => onChange({ sort })}
        />
        <Select
          label="分組"
          value={grouping}
          options={GROUPINGS}
          labels={GROUP_LABELS}
          onChange={(group) => onChange({ group })}
        />
        <label className="text-muted-foreground self-center text-xs">
          最少人次{' '}
          <select
            value={min}
            aria-label="最少修課人次"
            onChange={(e) => onChange({ min: Number(e.target.value) })}
            className="bg-card text-foreground rounded-lg border px-2 py-1.5 text-xs"
          >
            {MIN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? '不限' : `${n} 人`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={`搜尋${unit === '位教師' ? '教師或課程名稱' : '課程或教師名稱'}`}
        aria-label="搜尋"
        className="bg-card focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  )
}
