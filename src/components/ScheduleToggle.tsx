import { useState } from 'react'
import type { CourseIndexEntry } from '@/types/api'
import { updateStore, useStore } from '@/hooks/useStore'
import { addToSchedule, isInSchedule, removeFromSchedule } from '@/lib/storeActions'

/**
 * 加入 / 移出課表。
 *
 * **不擋衝堂**(plan §3.5)—— 使用者可能正在比較兩個方案,課表頁會標紅提醒。
 */
export function ScheduleToggle({
  course,
  semester,
  variant = 'icon',
}: {
  course: CourseIndexEntry
  semester: string
  /** `icon` 給搜尋卡片的角落,`button` 給詳情頁。 */
  variant?: 'icon' | 'button'
}) {
  const store = useStore()
  const added = isInSchedule(store, semester, course.id)
  const [error, setError] = useState<string | null>(null)

  const toggle = () => {
    const result = updateStore((s) =>
      added
        ? removeFromSchedule(s, semester, course.id)
        : addToSchedule(s, semester, course),
    )
    // 存不下就要說 —— 使用者以為加好了、重新整理後不見,比當下講清楚更糟
    setError(
      result.ok
        ? null
        : result.reason === 'quota'
          ? '瀏覽器空間已滿，存不下了'
          : '這個瀏覽器不允許儲存資料（無痕視窗？）',
    )
  }

  const label = added ? `從課表移除 ${course.name_zh}` : `加入課表 ${course.name_zh}`

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={added}
        title={error ?? label}
        className={`focus-visible:ring-ring grid size-7 place-items-center rounded-lg text-lg leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          added
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-accent'
        }`}
      >
        <span aria-hidden>{added ? '✓' : '+'}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={added}
        className={`focus-visible:ring-ring rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none ${
          added
            ? 'bg-secondary text-secondary-foreground hover:bg-accent'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {added ? '已在課表' : '加入課表'}
      </button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
