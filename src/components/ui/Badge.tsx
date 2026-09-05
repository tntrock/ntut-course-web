/**
 * 徽章。三級,別再多。
 *
 * - `strong`:必修。選課時最先要判斷的事
 * - `normal`:選修類別、授課語言
 * - `quiet`:學分、時數、人數這種數字,看得到就好
 *
 * 搜尋卡片與課程詳情頁共用同一個元件 —— 兩邊各寫一份的話,遲早會變成同一個
 * 欄位在兩個地方長得不一樣。
 */
export function Badge({
  tone = 'normal',
  children,
}: {
  tone?: 'strong' | 'normal' | 'quiet'
  children: React.ReactNode
}) {
  const styles = {
    strong: 'bg-primary-muted text-primary font-medium',
    normal: 'bg-secondary text-secondary-foreground',
    quiet: 'text-muted-foreground',
  }[tone]

  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap ${styles}`}>
      {children}
    </span>
  )
}
