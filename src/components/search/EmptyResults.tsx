import { RELAX_LABELS, type Relaxation, type RelaxTarget } from '@/lib/suggest'

/**
 * 空結果不只說「找不到」 —— 直接指出移除哪個條件會有結果。
 *
 * 使用者通常不知道是哪個條件卡住的,尤其時段格子這種點了很多下的條件。
 */
export function EmptyResults({
  suggestions,
  onRelax,
}: {
  suggestions: readonly Relaxation[]
  onRelax: (target: RelaxTarget) => void
}) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="font-medium">沒有符合條件的課</p>

      {suggestions.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          試著放寬幾個條件,或換個關鍵字。
        </p>
      ) : (
        <>
          <p className="text-muted-foreground mt-2 text-sm">移除以下條件就會有結果:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s.remove}
                type="button"
                onClick={() => onRelax(s.remove)}
                className="hover:bg-accent focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                移除「{RELAX_LABELS[s.remove]}」
                <span className="text-muted-foreground ml-1 tabular-nums">
                  {s.count} 筆
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
