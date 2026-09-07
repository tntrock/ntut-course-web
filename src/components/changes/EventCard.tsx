import { Chevron, SUMMARY_CLASS } from '@/components/ui/Disclosure'
import { Link } from '@tanstack/react-router'
import type {
  BaselineEvent,
  BulkChangeEvent,
  ChangeEvent,
  CourseChangedEvent,
  PeriodDef,
  TeacherEvent,
} from '@/types/api'
import {
  bulkBreakdown,
  fieldLabel,
  formatFieldValue,
  type NameLookup,
} from '@/lib/changes'
import { formatTaipei } from '@/lib/datetime'

/**
 * 事件類別的顏色與說法。
 *
 * **這張表一定會缺。** crawler 新增一種 `type` 不會升 `schema_version` ——
 * `teacher_added` 就是這樣冒出來的,而當時 `KINDS[type]` 回 `undefined`、
 * 讀 `.tone` 直接讓整個異動頁掛掉。認不得的型別原樣顯示代碼就好。
 */
const KINDS: Record<string, { label: string; tone: string }> = {
  course_added: { label: '加開', tone: 'bg-success/15 text-success' },
  course_removed: { label: '停開', tone: 'bg-destructive/15 text-destructive' },
  course_changed: { label: '異動', tone: 'bg-warning/15 text-warning' },
  teacher_added: { label: '新增教師', tone: 'bg-success/15 text-success' },
  teacher_removed: { label: '教師離開', tone: 'bg-destructive/15 text-destructive' },
  bulk_change: { label: '大量異動', tone: 'bg-warning/15 text-warning' },
  baseline: { label: '首次收錄', tone: 'bg-secondary text-muted-foreground' },
}

const UNKNOWN_KIND = { tone: 'bg-secondary text-muted-foreground' }

/*
 * 型別守衛而不是直接比對 `type`。
 *
 * 除了收窄型別,它們還多做一件事:**確認那個型別真的帶著該有的欄位**。事件是
 * append-only 的,舊的 `bulk_change` 沒有 `counts` —— 那種事件當成一般事件顯示,
 * 比渲染到一半炸掉好。
 */
function isBaseline(e: ChangeEvent): e is BaselineEvent {
  return e.type === 'baseline' && 'course_count' in e
}

function isBulk(e: ChangeEvent): e is BulkChangeEvent {
  return e.type === 'bulk_change' && 'counts' in e
}

function isChanged(e: ChangeEvent): e is CourseChangedEvent {
  return e.type === 'course_changed' && 'changes' in e
}

function isTeacher(e: ChangeEvent): e is TeacherEvent {
  return (e.type === 'teacher_added' || e.type === 'teacher_removed') && 'id' in e
}

function Tag({ type }: { type: string }) {
  const kind = KINDS[type]
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${kind?.tone ?? UNKNOWN_KIND.tone}`}
    >
      {kind?.label ?? type}
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

export function EventCard({
  event,
  names,
  periods,
}: {
  event: ChangeEvent
  names: NameLookup
  /** 時段要靠它才排得對。沒給的話那一欄會退回原始 JSON。 */
  periods: readonly PeriodDef[]
}) {
  return (
    <article className="bg-card shadow-card rounded-xl px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Tag type={event.type} />
        <div className="min-w-0 flex-1">
          {isBaseline(event) ? (
            <p className="text-sm">
              {event.semester} 首次收錄
              <span className="text-muted-foreground ml-2 tabular-nums">
                {event.course_count.toLocaleString('zh-TW')} 門課
              </span>
            </p>
          ) : isBulk(event) ? (
            <BulkChange event={event} names={names} />
          ) : isTeacher(event) ? (
            <TeacherLine event={event} names={names} />
          ) : (
            <CourseLine event={event} names={names} periods={periods} />
          )}
        </div>
        <Time at={event.at} />
      </div>
    </article>
  )
}

/**
 * 課程事件。**每個欄位都可能不存在** —— 事件是 append-only 的,舊事件缺少後來
 * 才加的欄位;認不得的型別也走這裡。缺了就少顯示一段,不要整張卡片消失。
 */
function CourseLine({
  event,
  names,
  periods,
}: {
  event: ChangeEvent
  names: NameLookup
  periods: readonly PeriodDef[]
}) {
  const id = 'id' in event ? event.id : undefined
  const name = ('name' in event ? event.name : undefined) ?? id ?? '(無名稱)'
  const teachers = 'teachers' in event ? event.teachers : undefined
  const depts = 'department_ids' in event ? event.department_ids : undefined

  return (
    <>
      {id === undefined ? (
        <span className="text-sm font-medium">{name}</span>
      ) : (
        <Link
          to="/course/$semester/$courseId"
          params={{ semester: event.semester, courseId: id }}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
      )}
      <p className="text-muted-foreground mt-0.5 text-xs">
        {event.semester}
        {teachers && (
          <>
            <span className="mx-1.5">·</span>
            {teachers.length > 0 ? teachers.join('、') : '未定'}
          </>
        )}
        {depts && depts.length > 0 && (
          <>
            <span className="mx-1.5">·</span>
            {formatFieldValue('department_ids', depts, names)}
          </>
        )}
      </p>
      {isChanged(event) && <FieldDiff event={event} names={names} periods={periods} />}
    </>
  )
}

/** 教師事件。這裡的 `id` 是**教師代碼**,連到教師頁而不是課程頁。 */
function TeacherLine({ event, names }: { event: TeacherEvent; names: NameLookup }) {
  return (
    <>
      <Link
        to="/teacher/$semester/$teacherId"
        params={{ semester: event.semester, teacherId: event.id }}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {event.name}
      </Link>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {event.semester}
        {event.course_count !== undefined && (
          <>
            <span className="mx-1.5">·</span>
            {event.course_count} 門課
          </>
        )}
        {event.department_ids && event.department_ids.length > 0 && (
          <>
            <span className="mx-1.5">·</span>
            {formatFieldValue('department_ids', event.department_ids, names)}
          </>
        )}
      </p>
    </>
  )
}

/** 逐欄位的 舊 → 新。只說「有異動」對使用者沒有用。 */
function FieldDiff({
  event,
  names,
  periods,
}: {
  event: CourseChangedEvent
  names: NameLookup
  periods: readonly PeriodDef[]
}) {
  return (
    <dl className="mt-2 space-y-1 text-xs">
      {Object.entries(event.changes).map(([key, diff]) => (
        <div key={key} className="grid grid-cols-[4.5rem_1fr] gap-2">
          <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
          <dd>
            <span className="text-muted-foreground line-through">
              {formatFieldValue(key, diff.from, names, periods)}
            </span>
            <span className="mx-1.5">→</span>
            <span>{formatFieldValue(key, diff.to, names, periods)}</span>
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
  // 2026-09-04 之前寫的 bulk_change 沒有這幾個欄位。缺了就少畫一段橫條圖
  const departments = bulkBreakdown(event.by_department ?? {}, names.department)
  const classes = bulkBreakdown(event.by_class ?? {}, names.classGroup)
  const samples = event.samples ?? []

  const summary = Object.entries(event.counts)
    .map(([type, count]) => `${KINDS[type]?.label ?? type} ${count}`)
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

      {samples.length > 0 && (
        <details className="group mt-2">
          <summary className={`text-muted-foreground text-xs ${SUMMARY_CLASS}`}>
            <Chevron />看 {samples.length} 筆樣本
          </summary>
          <ul className="mt-1.5 space-y-1">
            {samples.map((sample) => (
              <li key={`${sample.type}-${'id' in sample ? sample.id : sample.at}`}>
                {'id' in sample ? (
                  <Link
                    to="/course/$semester/$courseId"
                    params={{ semester: sample.semester, courseId: sample.id }}
                    className="text-xs underline-offset-4 hover:underline"
                  >
                    <span className="text-muted-foreground mr-1.5">
                      {KINDS[sample.type]?.label ?? sample.type}
                    </span>
                    {sample.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {KINDS[sample.type]?.label ?? sample.type}
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
