import { Link } from '@tanstack/react-router'
import type { ChangeEvent, CourseChangedEvent } from '@/types/api'
import {
  bulkBreakdown,
  fieldLabel,
  formatFieldValue,
  type NameLookup,
} from '@/lib/changes'
import { formatTaipei } from '@/lib/datetime'

/** 事件類別的顏色與說法。五種都要有,不能讓任何一種掉進「其他」。 */
const KINDS = {
  course_added: { label: '加開', tone: 'bg-success/15 text-success' },
  course_removed: { label: '停開', tone: 'bg-destructive/15 text-destructive' },
  course_changed: { label: '異動', tone: 'bg-warning/15 text-warning' },
  bulk_change: { label: '大量異動', tone: 'bg-warning/15 text-warning' },
  baseline: { label: '首次收錄', tone: 'bg-secondary text-muted-foreground' },
} as const

function Tag({ type }: { type: ChangeEvent['type'] }) {
  const kind = KINDS[type]
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${kind.tone}`}>
      {kind.label}
    </span>
  )
}

function Time({ at }: { at: string }) {
  return (
    <span
      className="text-muted-foreground shrink-0 text-xs tabular-nums"
      // `at` 是本站偵測到的時間,不是學校異動的時間 —— 實際異動落在前一次抓取
      // 與這次之間(最多差 4 小時)
      title={`本站於 ${formatTaipei(at)} 偵測到`}
    >
      {formatTaipei(at).slice(11)}
    </span>
  )
}

export function EventCard({ event, names }: { event: ChangeEvent; names: NameLookup }) {
  return (
    <article className="bg-card shadow-card rounded-xl px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Tag type={event.type} />
        <div className="min-w-0 flex-1">
          {event.type === 'baseline' ? (
            <p className="text-sm">
              {event.semester} 首次收錄
              <span className="text-muted-foreground ml-2 tabular-nums">
                {event.course_count.toLocaleString('zh-TW')} 門課
              </span>
            </p>
          ) : event.type === 'bulk_change' ? (
            <BulkChange event={event} names={names} />
          ) : (
            <>
              <Link
                to="/course/$semester/$courseId"
                params={{ semester: event.semester, courseId: event.id }}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {event.name}
              </Link>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {event.semester}
                <span className="mx-1.5">·</span>
                {event.teachers.length > 0 ? event.teachers.join('、') : '未定'}
                <span className="mx-1.5">·</span>
                {formatFieldValue('department_ids', event.department_ids, names)}
              </p>
              {event.type === 'course_changed' && (
                <FieldDiff event={event} names={names} />
              )}
            </>
          )}
        </div>
        <Time at={event.at} />
      </div>
    </article>
  )
}

/** 逐欄位的 舊 → 新。只說「有異動」對使用者沒有用。 */
function FieldDiff({ event, names }: { event: CourseChangedEvent; names: NameLookup }) {
  return (
    <dl className="mt-2 space-y-1 text-xs">
      {Object.entries(event.changes).map(([key, diff]) => (
        <div key={key} className="grid grid-cols-[4.5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
          <dd>
            <span className="text-muted-foreground line-through">
              {formatFieldValue(key, diff.from, names)}
            </span>
            <span className="mx-1.5">→</span>
            <span>{formatFieldValue(key, diff.to, names)}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Bar({ rows }: { rows: { id: string; name: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div className="mt-1.5 space-y-1">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-2"
        >
          <span className="truncate text-xs">{row.name}</span>
          <span className="bg-secondary h-2 overflow-hidden rounded-full">
            <span
              className="bg-primary block h-full rounded-full"
              style={{ width: `${((row.count / max) * 100).toFixed(1)}%` }}
            />
          </span>
          <span className="text-muted-foreground text-right text-xs tabular-nums">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * 一次異動太多筆時,crawler 會收斂成單一事件。
 *
 * 橫條圖的用途不只是好看:**分組集中在少數幾個單位 = 學校開了一批課;
 * 散落在幾十個系所 = 可能是解析器出問題。** 這個判讀方式要寫在卡片上,
 * 讓使用者自己看得出來。
 */
function BulkChange({
  event,
  names,
}: {
  event: Extract<ChangeEvent, { type: 'bulk_change' }>
  names: NameLookup
}) {
  const departments = bulkBreakdown(event.by_department, names.department)
  const classes = bulkBreakdown(event.by_class, names.classGroup)

  const summary = Object.entries(event.counts)
    .map(([type, count]) => `${KINDS[type as keyof typeof KINDS].label} ${count}`)
    .join('、')

  return (
    <div>
      <p className="text-sm font-medium">
        {event.semester} 一次異動 {event.event_count.toLocaleString('zh-TW')} 筆
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">{summary}</p>
      {event.note && <p className="text-muted-foreground mt-1 text-xs">{event.note}</p>}

      {departments.length > 0 && (
        <section className="mt-3">
          <h4 className="text-muted-foreground text-xs font-medium">依系所</h4>
          <Bar rows={departments} />
        </section>
      )}

      {classes.length > 0 && (
        <section className="mt-3">
          <h4 className="text-muted-foreground text-xs font-medium">依班級</h4>
          <Bar rows={classes} />
        </section>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        集中在少數幾個單位通常是學校開了一批課；散落在幾十個系所才需要懷疑是資料解析出了問題。
      </p>

      {event.samples.length > 0 && (
        <details className="mt-2">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            看 {event.samples.length} 筆樣本
          </summary>
          <ul className="mt-1.5 space-y-1">
            {event.samples.map((sample) => (
              <li key={`${sample.type}-${'id' in sample ? sample.id : sample.at}`}>
                {'id' in sample ? (
                  <Link
                    to="/course/$semester/$courseId"
                    params={{ semester: sample.semester, courseId: sample.id }}
                    className="text-xs underline-offset-4 hover:underline"
                  >
                    <span className="text-muted-foreground mr-1.5">
                      {KINDS[sample.type].label}
                    </span>
                    {sample.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {KINDS[sample.type].label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
