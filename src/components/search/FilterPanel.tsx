import type { CourseIndexEntry, DepartmentsResponse, PeriodDef } from '@/types/api'
import { LANGUAGE_ZH, type TimeMode } from '@/lib/filters'
import { collegeGroups } from '@/lib/browse'
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

/**
 * 可收合的篩選分區。
 *
 * 原本五個分區全部攤開,一進站就是一整面長得一模一樣的灰色晶片 ——
 * 光是系所就有 60 個。收起來之後,畫面上剩下的是「有哪些條件可以用」,
 * 而不是「這裡有幾百個按鈕」。
 *
 * 用原生 `<details>`:鍵盤操作與無障礙都是瀏覽器內建的,自己用 state 做一份
 * 只會少掉這些。已經套用條件的分區自動展開 —— 看不到自己套了什麼最糟。
 */
function Section({
  title,
  active,
  defaultOpen = false,
  children,
}: {
  title: string
  /** 這個分區目前套用了幾個條件。0 就不顯示。 */
  active: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen || active > 0} className="group border-b">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium select-none marker:content-none">
        <span className="flex-1">{title}</span>
        {active > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">
            {active}
          </span>
        )}
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
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
      className={`focus-visible:ring-ring rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-accent'
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
  onClear,
}: {
  courses: readonly CourseIndexEntry[]
  departments: DepartmentsResponse
  periods: readonly PeriodDef[]
  values: FilterValues
  onChange: (patch: Partial<FilterValues>) => void
  onClear: () => void
}) {
  const options = distinct(courses)
  const creditsActive = values.cmin !== undefined || values.cmax !== undefined
  const total =
    values.dept.length +
    values.req.length +
    values.lang.length +
    values.slot.length +
    (creditsActive ? 1 : 0)

  return (
    <div className="text-sm">
      <div className="flex h-9 items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {total > 0 ? `已套用 ${total} 個條件` : '篩選'}
        </span>
        {total > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-primary hover:bg-accent focus-visible:ring-ring rounded-md px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            清除
          </button>
        )}
      </div>

      <Section title="學院 / 系所" active={values.dept.length}>
        {/*
          原本這一塊自己開了一個 max-h + overflow 的捲動框,於是畫面上出現第三條
          捲軸。收合之後就不需要了 —— 展開時讓整頁一起捲就好。
        */}
        <div className="space-y-3">
          {collegeGroups(departments).map((college) => (
            <div key={college.name}>
              <p className="text-muted-foreground mb-1 text-xs">{college.name}</p>
              <div className="flex flex-wrap gap-1">
                {college.departments.map((d) => (
                  <Chip
                    key={d.id}
                    active={values.dept.includes(d.id)}
                    onClick={() => onChange({ dept: toggle(values.dept, d.id) })}
                  >
                    {d.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="必選修" active={values.req.length} defaultOpen>
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

      <Section title="授課語言" active={values.lang.length} defaultOpen>
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

      <Section title="星期 / 節次" active={values.slot.length}>
        <TimeGrid
          periods={periods}
          selected={values.slot}
          mode={values.time}
          onToggle={(key) => onChange({ slot: toggle(values.slot, key) })}
          onToggleMode={(time) => onChange({ time })}
          onClear={() => onChange({ slot: [] })}
        />
      </Section>

      <Section title="學分" active={creditsActive ? 1 : 0}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={options.maxCredits}
            step={0.5}
            name="cmin"
            value={values.cmin ?? ''}
            placeholder="最低"
            aria-label="最低學分"
            onChange={(e) =>
              onChange({
                cmin: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="bg-card w-20 rounded-lg border px-2 py-1 tabular-nums"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            min={0}
            max={options.maxCredits}
            step={0.5}
            name="cmax"
            value={values.cmax ?? ''}
            placeholder="最高"
            aria-label="最高學分"
            onChange={(e) =>
              onChange({
                cmax: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="bg-card w-20 rounded-lg border px-2 py-1 tabular-nums"
          />
        </div>
      </Section>
    </div>
  )
}
