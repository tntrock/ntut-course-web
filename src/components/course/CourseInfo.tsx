import { Link } from '@tanstack/react-router'

import { formatSlotClock, formatTimeSlots } from '@/lib/formatTime'
import type { Course, Meta, SemesterPath } from '@/types/api'

/**
 * 一列「標籤 / 內容」。內容為空就整列不顯示,不要留一排空欄位。
 *
 * `wide` 給內容會很長的欄位(學程、備註那類)——它們在兩欄版面裡會被擠到換行,
 * 直接讓它們佔滿一整列比較好讀。
 */
function Row({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: React.ReactNode
}) {
  if (children === null || children === undefined || children === false) return null
  return (
    <div
      className={`grid grid-cols-[5rem_1fr] gap-3 border-t py-2.5 text-sm ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * 名稱與代碼是兩個平行陣列(`teachers`/`teacher_codes` 之類)。實測 2,717 門課
 * 的長度全部對得上,但對不上時**寧可顯示純文字也不要生出連到別人頁面的連結** ——
 * 錯的連結比沒有連結糟。
 */
function NameLink({
  name,
  id,
  render,
}: {
  name: string
  id: string | undefined
  render: (id: string) => React.ReactNode
}) {
  if (id === undefined || id === '') return <span>{name}</span>
  return <>{render(id)}</>
}

export function CourseInfo({
  course,
  semester,
  meta,
  deptName,
}: {
  course: Course
  semester: SemesterPath
  meta: Meta
  deptName: ReadonlyMap<string, string>
}) {
  const withdrawn = course.withdrawn ?? 0

  return (
    /* 寬螢幕排兩欄:六個短欄位擠成三列,少捲一半 */
    <dl className="sm:grid sm:grid-cols-2 sm:gap-x-6">
      <Row label="時段">
        {course.time_slots.length === 0 ? (
          <span className="text-muted-foreground">無固定時段</span>
        ) : (
          <ul className="space-y-0.5">
            {course.time_slots.map((slot) => {
              const clock = formatSlotClock(slot, meta.periods)
              return (
                <li key={`${slot.day}-${slot.periods.join('')}`}>
                  {formatTimeSlots({ ...course, time_slots: [slot] }, meta.periods)}
                  {clock && (
                    <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                      {clock}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Row>

      <Row label="教師">
        {course.teachers.length === 0 ? (
          <span className="text-muted-foreground">未定</span>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {/* 連結一律走**教師代碼**，不是姓名 —— 實測有兩組同名老師，
                用姓名會把兩個人的課混在一起 */}
            {course.teachers.map((name, i) => (
              <NameLink
                key={course.teacher_codes[i] ?? name}
                name={name}
                id={course.teacher_codes[i]}
                render={(id) => (
                  <Link
                    to="/teacher/$semester/$teacherId"
                    params={{ semester, teacherId: id }}
                    className="underline underline-offset-4"
                  >
                    {name}
                  </Link>
                )}
              />
            ))}
          </div>
        )}
      </Row>

      <Row label="系所">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {course.department_ids.map((id) => (
            <Link
              key={id}
              to="/dept/$semester/$deptId"
              params={{ semester, deptId: id }}
              className="underline underline-offset-4"
            >
              {deptName.get(id) ?? id}
            </Link>
          ))}
        </div>
      </Row>

      {course.classes.length > 0 && (
        <Row label="班級">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {course.classes.map((name, i) => (
              <NameLink
                key={course.class_ids[i] ?? name}
                name={name}
                id={course.class_ids[i]}
                render={(id) => (
                  <Link
                    to="/class/$semester/$classId"
                    params={{ semester, classId: id }}
                    className="underline underline-offset-4"
                  >
                    {name}
                  </Link>
                )}
              />
            ))}
          </div>
        </Row>
      )}

      {course.classrooms.length > 0 && (
        <Row label="教室">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {course.classrooms.map((name, i) => (
              <NameLink
                key={course.classroom_codes[i] ?? name}
                name={name}
                id={course.classroom_codes[i]}
                render={(id) => (
                  <Link
                    to="/classroom/$semester/$classroomId"
                    params={{ semester, classroomId: id }}
                    className="underline underline-offset-4"
                  >
                    {name}
                  </Link>
                )}
              />
            ))}
          </div>
        </Row>
      )}

      <Row label="修課人數">
        {course.enrolled === null ? (
          <span className="text-muted-foreground">未提供</span>
        ) : (
          <span className="tabular-nums">
            {/* `enrolled` 是修課人數不是名額上限，文案不能寫「名額」 */}
            修課 {course.enrolled} 人
            {withdrawn > 0 && <span className="ml-2">撤選 {withdrawn} 人</span>}
          </span>
        )}
      </Row>

      {course.programs.length > 0 && (
        <Row label="學程" wide>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {course.programs.map((name) => (
              <Link
                key={name}
                to="/program/$semester/$programName"
                params={{ semester, programName: name }}
                className="underline underline-offset-4"
              >
                {name}
              </Link>
            ))}
          </div>
        </Row>
      )}

      {course.audit && (
        <Row label="隨班附讀" wide>
          {course.audit}
        </Row>
      )}
      {course.lab && (
        <Row label="實習" wide>
          {course.lab}
        </Row>
      )}
    </dl>
  )
}
