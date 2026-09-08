import { Link } from '@tanstack/react-router'
import { BackLink } from '@/components/BackLink'
import { UNKNOWN_CHAR } from '@/lib/pua'
import type { BrowseTab } from '@/lib/browseTabs'

/**
 * 五個明細頁(系所 / 教師 / 班級 / 學程 / 教室)共用的外框。
 *
 * 它們的差別只在標題那一塊,課程列表與返回動線完全一樣 —— 抽出來才不會五份各自
 * 長出不一樣的細節。
 */
export function DetailShell({
  kind,
  title,
  meta,
  sourceUrl,
  browseTab,
  semester,
  children,
}: {
  /** 「系所」「教師」…,標在標題上方,讓人知道自己在看什麼。 */
  kind: string
  title: string
  /** 標題底下的一行說明,例如所屬學院、系所。 */
  meta?: React.ReactNode
  /** 學校原始頁面。沒有就不顯示。 */
  sourceUrl?: string | null
  browseTab: BrowseTab
  semester: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* 系所頁可能從瀏覽進來，也可能從某一門課的「系所」連結進來 */}
      <BackLink
        fallback={
          <Link
            to="/browse"
            search={{ sem: semester, tab: browseTab }}
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            ← 回瀏覽
          </Link>
        }
      />

      <header className="mt-4">
        <p className="text-muted-foreground text-xs">{kind}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{title}</h1>
        {meta && <div className="text-muted-foreground mt-1 text-sm">{meta}</div>}
        {/*
          「林〇」單獨擺著仍然像資料壞了,要講一句這個〇是什麼。
          實測 805 位教師沒有任何一位姓名裡本來就有〇,所以直接比對就夠。
        */}
        {title.includes(UNKNOWN_CHAR) && (
          <p className="text-muted-foreground mt-1 text-xs">
            {UNKNOWN_CHAR}{' '}
            是學校原始資料裡的造字，沒有標準編碼，任何字型都顯示不出來。正確的字請看學校原始頁面。
          </p>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs underline underline-offset-4"
          >
            學校原始頁面
          </a>
        )}
      </header>

      {/* 課程列表本身就是一格一格的卡片，外面再包一層卡片會變成卡片裡的卡片 */}
      <div className="mt-5">{children}</div>
    </div>
  )
}

/** 明細頁的「查無此⋯」。訊息要說得出是哪個學期的哪個東西。 */
export function DetailNotFound({
  kind,
  id,
  name,
  semester,
  browseTab,
  hint,
}: {
  kind: string
  id: string
  /** 名稱。查得到就顯示名稱 —— 代碼是給機器看的。 */
  name?: string | undefined
  semester: string
  browseTab?: BrowseTab
  hint?: string
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">查無此{kind}</h1>
      {/*
        **有名字就顯示名字。** 這一頁是給人看的,「沒有 24622 這個教師」
        對使用者沒有任何意義,他要找的是「侯政伯」。
      */}
      <p className="text-muted-foreground mt-2 text-sm">
        {semester} 沒有{name === undefined ? `代碼 ${id} 的` : `「${name}」這個`}
        {kind}。{hint ?? '代碼在不同學期並不通用，舊連結換到別的學期通常就查不到了。'}
      </p>
      {/* 使用者是從某一頁點進來的,把他送回那一頁,不是丟到瀏覽頁 */}
      <div className="mt-6">
        <BackLink
          fallback={
            <Link
              to="/browse"
              search={{ sem: semester, ...(browseTab ? { tab: browseTab } : {}) }}
              className="text-muted-foreground text-sm underline underline-offset-4"
            >
              ← 回瀏覽
            </Link>
          }
        />
      </div>
    </div>
  )
}
