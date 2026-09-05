import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { useStore } from '@/hooks/useStore'
import { teachersQueryOptions } from '@/hooks/useBrowse'
import { parseImport, saveStore, serializeStore } from '@/lib/storage'
import type { CourseIndexEntry, Meta } from '@/types/api'

/**
 * 收藏的課程與追蹤的教師。
 *
 * 收藏與課表是兩件事:課表是「我要修」,收藏是「我在考慮」——
 * 所以收藏不佔格子、不算學分,只是一份待辦清單。
 */
export function Favorites({
  meta,
  semester,
  courses,
}: {
  meta: Meta
  semester: string
  /** 當期索引。離線時是 `null`,那就只顯示課號。 */
  courses: ReadonlyMap<string, CourseIndexEntry> | null
}) {
  const store = useStore()

  // 只列出當前學期的收藏 —— 別的學期要看,切學期就好。
  // 課號跨學期不通用,混在一起列會讓人以為那些課這學期也有開
  const prefix = `${semester}:`
  const favoriteIds = store.favorites.courses
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))

  const teacherCodes = store.favorites.teachers
  // 沒有追蹤任何老師時不要多打一個 15 KB 的請求
  const teachers = useQuery({
    ...teachersQueryOptions(meta, semester),
    enabled: teacherCodes.length > 0,
  })
  const teacherName = new Map(
    (teachers.data?.teachers ?? []).map((t) => [t.id, t.name]),
  )

  if (favoriteIds.length === 0 && teacherCodes.length === 0) return null

  return (
    <section className="mt-6">
      <h2 className="text-muted-foreground text-xs font-medium">收藏</h2>

      {favoriteIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {favoriteIds.map((id) => (
            <Link
              key={id}
              to="/course/$semester/$courseId"
              params={{ semester, courseId: id }}
              className="bg-card shadow-card hover:ring-primary/40 rounded-lg px-3 py-2 text-sm hover:ring-1"
            >
              {/* 離線時索引拿不到,退回顯示課號而不是空白 */}
              {courses?.get(id)?.name_zh ?? id}
            </Link>
          ))}
        </div>
      )}

      {teacherCodes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {teacherCodes.map((code) => (
            <Link
              key={code}
              to="/teacher/$semester/$teacherId"
              params={{ semester, teacherId: code }}
              className="bg-card shadow-card hover:ring-primary/40 rounded-lg px-3 py-2 text-sm hover:ring-1"
            >
              {teacherName.get(code) ?? `教師 ${code}`}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * 匯出 / 匯入。
 *
 * 個人資料只在這台瀏覽器裡(plan §7 風險 7)—— 換裝置、清瀏覽器資料就沒了。
 * 這是唯一的補償,所以匯入**要先確認**:蓋掉之後救不回來。
 */
export function DataTransfer() {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const download = () => {
    const blob = new Blob([serializeStore(store)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ntut-course-web-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    const result = parseImport(await file.text())

    if (!result.ok) {
      setMessage(
        result.reason === 'unsupported'
          ? '這個檔案是較新版本產生的,目前的版本讀不了。'
          : '這不是本站匯出的檔案。',
      )
      return
    }

    // 匯入是整包覆蓋,問過再做 —— 現有的課表會直接不見
    const courseCount = Object.values(result.store.schedules).reduce(
      (sum, s) => sum + s.courses.length,
      0,
    )
    if (
      !confirm(`匯入後會覆蓋目前的課表與收藏。檔案裡有 ${courseCount} 門課,確定嗎?`)
    ) {
      return
    }

    const saved = saveStore(result.store)
    if (!saved.ok) {
      setMessage(
        saved.reason === 'quota'
          ? '瀏覽器空間不足,匯入失敗。'
          : '這個瀏覽器不允許儲存資料。',
      )
      return
    }
    // 直接重新載入最單純 —— 匯入影響整個 store,重畫一次比逐處同步可靠
    location.reload()
  }

  return (
    <section className="mt-8 border-t pt-5">
      <h2 className="text-muted-foreground text-xs font-medium">資料</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        課表與收藏只存在這台裝置的瀏覽器裡。換裝置或清除瀏覽器資料就會不見,
        建議匯出備份。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="hover:bg-accent bg-card rounded-lg border px-3 py-1.5 text-sm"
        >
          匯出 JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="hover:bg-accent bg-card rounded-lg border px-3 py-1.5 text-sm"
        >
          匯入 JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // 同一個檔案連選兩次也要能觸發
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>
      {message && <p className="text-destructive mt-2 text-xs">{message}</p>}
    </section>
  )
}
