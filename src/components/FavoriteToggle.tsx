import { updateStore, useStore } from '@/hooks/useStore'
import { isFavoriteCourse, toggleFavoriteCourse } from '@/lib/storeActions'

/**
 * 收藏課程。
 *
 * 與「加入課表」是兩件事:課表是「我要修」,收藏是「我在考慮」——
 * 收藏不佔課表格子,也不算進學分,所以不會影響衝堂判斷。
 */
export function FavoriteToggle({
  semester,
  courseId,
}: {
  semester: string
  courseId: string
}) {
  const store = useStore()
  const favorited = isFavoriteCourse(store, semester, courseId)

  return (
    <button
      type="button"
      onClick={() => updateStore((s) => toggleFavoriteCourse(s, semester, courseId))}
      aria-pressed={favorited}
      aria-label={favorited ? '取消收藏' : '收藏'}
      title={favorited ? '取消收藏' : '收藏'}
      className={`focus-visible:ring-ring grid size-9 place-items-center rounded-lg border text-base focus-visible:ring-2 focus-visible:outline-none ${
        favorited
          ? 'bg-primary-muted text-primary border-transparent'
          : 'hover:bg-accent'
      }`}
    >
      <span aria-hidden>{favorited ? '★' : '☆'}</span>
    </button>
  )
}
