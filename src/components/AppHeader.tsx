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

  /*
   * 手機版排兩列:第一列是站徽 + 搜尋框 + 外觀切換,第二列整條給導覽。
   *
   * 原本三個都擠在同一個 flex-wrap 裡,390px 下每個導覽項目都被壓縮 3~4px,
   * 於是「空教室」斷成「空教／室」、「搜尋」斷成「搜／尋」—— 六個項目全部變成
   * 兩行高,sticky 頁首吃掉 150px,接近螢幕的五分之一。
   *
   * 導覽獨立一列之後就有 358px 可用,六個項目 316px 放得下;真的更窄的機器
   * (320px)則橫向捲動,不再壓縮文字。`shrink-0` + `whitespace-nowrap` 是
   * 關鍵——沒有它們,flex 仍然會為了塞進去而把每個標籤折行。
   */
  return (
    <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <Link
          to="/"
          // 站名在手機版被藏起來(只剩 aria-hidden 的徽章),連結會變成沒有名字。
          // Lighthouse 的 link-name 就是抓到這個
          aria-label="北科課程 首頁"
          className="focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-lg text-sm font-bold"
          >
            北
          </span>
          <span className="hidden sm:inline">北科課程</span>
        </Link>

        <form onSubmit={submit} className="order-2 min-w-0 flex-1">
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

        {/*
          `-mx-4 px-4`:捲動時內容要能貼到螢幕邊緣,不然最後一項會卡在內距裡
          看起來像被切掉。捲軸本身藏起來——這是一條隨手滑的分頁列,不是內容區。
        */}
        <nav
          className="order-4 -mx-4 flex w-full [scrollbar-width:none] items-center gap-1 overflow-x-auto px-4 text-sm sm:order-3 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label="主要導覽"
        >
          <NavLink to="/search">搜尋</NavLink>
          <NavLink to="/browse">瀏覽</NavLink>
          <NavLink to="/rooms">空教室</NavLink>
          <NavLink to="/withdrawal">退選率</NavLink>
          <NavLink to="/schedule">課表</NavLink>
          <NavLink to="/changes">異動</NavLink>
        </nav>

        {/* 外觀切換不是導覽,本來就不該在 <nav> 裡 */}
        <div className="order-3 shrink-0 sm:order-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function NavLink({
  to,
  children,
}: {
  to: '/search' | '/browse' | '/rooms' | '/withdrawal' | '/schedule' | '/changes'
  children: string
}) {
  return (
    <Link
      to={to}
      // `shrink-0` + `whitespace-nowrap`:少了任何一個,flex 都會為了塞進去
      // 而把「空教室」折成「空教／室」。
      //
      // 手機上內距收窄一點(px-2),六個項目才剛好放得進 358px 不用捲;
      // 直向反而放寬(py-2),觸控目標從 32px 變成 36px
      className="focus-visible:ring-ring hover:bg-accent shrink-0 rounded-lg px-2 py-2 whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none sm:px-2.5 sm:py-1.5"
      // 目前所在的分頁用強調色標出來,不必再看網址
      activeProps={{ className: 'bg-primary-muted text-primary font-medium' }}
    >
      {children}
    </Link>
  )
}
