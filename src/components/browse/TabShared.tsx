import { Link } from '@tanstack/react-router'
import type { Meta } from '@/types/api'

/** 四個分頁的共同輸入。 */
export interface TabProps {
  meta: Meta
  semester: string
  query: string
}

export function Empty({ what }: { what: string }) {
  return (
    <p className="text-muted-foreground px-4 py-16 text-center text-sm">
      沒有符合的{what}。
    </p>
  )
}

/** 右側的門數。四個分頁共用。 */
export function Count({ n }: { n: number }) {
  return (
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{n} 門</span>
  )
}

export interface NameCountItem {
  key: string
  name: string
  count: number
  to: string
  params: Record<string, string>
}

/**
 * 「名稱 + 門數」的兩欄清單。
 *
 * 學程與教室兩個分頁的版面**完全一樣**,差別只在連結去哪裡 —— 各寫一份的話,
 * 調間距或 hover 樣式時就會有一邊被漏掉。
 */
export function NameCountList({ items }: { items: readonly NameCountItem[] }) {
  return (
    <div className="bg-card shadow-card grid rounded-xl px-3 sm:grid-cols-2 sm:gap-x-4">
      {items.map((item) => (
        <Link
          key={item.key}
          // 路由型別是字面聯集,這裡是共用元件所以收窄不了
          to={item.to as never}
          params={item.params as never}
          className="hover:bg-muted/40 flex items-center gap-3 border-b px-1 py-2.5"
        >
          <span className="flex-1 text-sm">{item.name}</span>
          <Count n={item.count} />
        </Link>
      ))}
    </div>
  )
}
