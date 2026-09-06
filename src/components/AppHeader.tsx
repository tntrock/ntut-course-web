import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useDebounced } from '@/hooks/useDebounced'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * 全站頁首。
 *
 * 在這之前每一頁都是孤島 —— 搜尋頁走不到瀏覽頁,詳情頁只能靠「← 回搜尋」。
 *
 * 搜尋框放在頁首而不是搜尋頁裡面,理由是它在**每一頁**都該隨手可用;
 * 而且只有一個搜尋框,就不會有「頁首打一個、頁面裡再打一個」的錯亂。
 */
export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const onSearchPage = location.pathname === '/search'

  // 網址是關鍵字的唯一真相。這裡只維持「還沒送出的那幾個字」
  const urlQuery = onSearchPage ? ((location.search as { q?: string }).q ?? '') : ''
  const [draft, setDraft] = useState(urlQuery)

  // 上一頁、點了建議、或從外部連結進來時,把輸入框同步回網址的值。
  // render 期調整而不是 effect —— effect 會讓輸入框先閃一下舊值
  const [lastQuery, setLastQuery] = useState(urlQuery)
  if (urlQuery !== lastQuery) {
    setLastQuery(urlQuery)
    setDraft(urlQuery)
  }

  const debounced = useDebounced(draft)

  useEffect(() => {
    if (!onSearchPage || debounced === urlQuery) return
    void navigate({
      to: '/search',
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev }
        // exactOptionalPropertyTypes 下不能塞 undefined,要真的把 key 拿掉
        if (debounced === '') delete next.q
        else next.q = debounced
        return next
      },
      // 每個按鍵都推一次歷史紀錄的話,上一頁會變成一個字一個字倒退
      replace: true,
    })
  }, [debounced, urlQuery, onSearchPage, navigate])

  /**
   * 不在搜尋頁時**不即時導頁**,按 Enter 才走。
   *
   * 否則在課程詳情頁不小心打了一個字,整頁就被抽掉了。
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (onSearchPage) return
    void navigate({ to: '/search', search: draft === '' ? {} : { q: draft } })
  }

  return (
    <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link
          to="/"
          // 站名在手機版被藏起來(只剩 aria-hidden 的徽章),連結會變成沒有名字。
          // Lighthouse 的 link-name 就是抓到這個
          aria-label="北科課程 首頁"
          className="focus-visible:ring-ring flex items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-lg text-sm font-bold"
          >
            北
          </span>
          <span className="hidden sm:inline">北科課程</span>
        </Link>

        <form onSubmit={submit} className="order-3 w-full sm:order-none sm:flex-1">
          <input
            type="search"
            name="q"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="搜尋課名、教師、課號"
            aria-label="搜尋課程"
            className="bg-card focus-visible:ring-ring w-full rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 text-sm sm:ml-0">
          <NavLink to="/search">搜尋</NavLink>
          <NavLink to="/browse">瀏覽</NavLink>
          <NavLink to="/rooms">空教室</NavLink>
          <NavLink to="/schedule">課表</NavLink>
          <NavLink to="/changes">異動</NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

function NavLink({
  to,
  children,
}: {
  to: '/search' | '/browse' | '/rooms' | '/schedule' | '/changes'
  children: string
}) {
  return (
    <Link
      to={to}
      className="focus-visible:ring-ring hover:bg-accent rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:outline-none"
      // 目前所在的分頁用強調色標出來,不必再看網址
      activeProps={{ className: 'bg-primary-muted text-primary font-medium' }}
    >
      {children}
    </Link>
  )
}
