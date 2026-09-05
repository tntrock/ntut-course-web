import type { CourseIndexEntry, DepartmentsResponse, PeriodDef } from '@/types/api'
import { LANGUAGE_ZH, type TimeMode } from '@/lib/filters'
import { TimeGrid } from './TimeGrid'

export interface FilterValues {
  dept: string[]
  req: string[]
  lang: string[]
  slot: string[]
  time: TimeMode
  cmin: number | undefined
  cmax: number | undefined
}

/**
 * 篩選選項一律**由當期資料動態產生**。
 *
 * 理由:必選修的 6 種類別在 115-1 只出現 4 種,寫死會讓使用者看到永遠 0 筆的
 * 按鈕;授課語言除了「英語」還實測出「中英雙語」,未來也可能再增加。
 */
function distinct(courses: readonly CourseIndexEntry[]) {
  const requirementTypes = new Set<string>()
  const languages = new Set<string>()
  let maxCredits = 0

  for (const c of courses) {
    if (c.requirement_type) requirementTypes.add(c.requirement_type)
    languages.add(c.language ?? LANGUAGE_ZH)
    if (c.credits !== null && c.credits > maxCredits) maxCredits = c.credits
  }

  return {
    requirementTypes: [...requirementTypes].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    ),
    languages: [...languages].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
    maxCredits: Math.ceil(maxCredits),
  }
}

const LANGUAGE_LABELS: Record<string, string> = { [LANGUAGE_ZH]: '中文' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`focus-visible:ring-ring rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FilterPanel({
  courses,
  departments,
  periods,
  values,
  onChange,
}: {
  courses: readonly CourseIndexEntry[]
  departments: DepartmentsResponse
  periods: readonly PeriodDef[]
  values: FilterValues
  onChange: (patch: Partial<FilterValues>) => void
}) {
  const options = distinct(courses)
  const deptName = new Map(departments.departments.map((d) => [d.id, d.name]))

  return (
    <div className="text-sm">
      <Section title="學院 / 系所">
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {departments.colleges.map((college) => (
            <div key={college.name}>
              <p className="text-muted-foreground mb-1 text-xs">{college.name}</p>
              <div className="flex flex-wrap gap-1">
                {college.department_ids.map((id) => (
                  <Chip
                    key={id}
                    active={values.dept.includes(id)}
                    onClick={() => onChange({ dept: toggle(values.dept, id) })}
                  >
                    {deptName.get(id) ?? id}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="必選修">
        <div className="flex flex-wrap gap-1">
          {options.requirementTypes.map((type) => (
            <Chip
              key={type}
              active={values.req.includes(type)}
              onClick={() => onChange({ req: toggle(values.req, type) })}
            >
              {type}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="授課語言">
        <div className="flex flex-wrap gap-1">
          {options.languages.map((lang) => (
            <Chip
              key={lang}
              active={values.lang.includes(lang)}
              onClick={() => onChange({ lang: toggle(values.lang, lang) })}
            >
              {LANGUAGE_LABELS[lang] ?? lang}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="星期 / 節次">
        <TimeGrid
          periods={periods}
          selected={values.slot}
          mode={values.time}
          onToggle={(key) => onChange({ slot: toggle(values.slot, key) })}
          onToggleMode={(time) => onChange({ time })}
          onClear={() => onChange({ slot: [] })}
        />
      </Section>

      <Section title="學分">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={options.maxCredits}
            step={0.5}
            value={values.cmin ?? ''}
            placeholder="最低"
            aria-label="最低學分"
            onChange={(e) =>
              onChange({
                cmin: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="bg-background w-20 rounded border px-2 py-1 tabular-nums"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            min={0}
            max={options.maxCredits}
            step={0.5}
            value={values.cmax ?? ''}
            placeholder="最高"
            aria-label="最高學分"
            onChange={(e) =>
              onChange({
                cmax: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="bg-background w-20 rounded border px-2 py-1 tabular-nums"
          />
        </div>
      </Section>
    </div>
  )
}
