import { useCanGoBack, useRouter } from '@tanstack/react-router'

/**
 * 「上一頁」。
 *
 * 課程詳情頁可以從搜尋進來,也可以從系所、教師、教室、學程任何一頁進來 ——
 * 寫死「回搜尋」對後面那些人是錯的,會把他們丟到一個沒去過的地方。
 *
 * 但**不能只呼叫 `history.back()`**:分享連結、書籤、新分頁開啟這些情況下
 * 站內沒有上一頁,按了要嘛沒反應、要嘛把人踢出這個網站。所以沒有站內歷史時
 * 退回呼叫端給的固定連結。
 */
export function BackLink({ fallback }: { fallback: React.ReactNode }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  if (!canGoBack) return <>{fallback}</>

  return (
    <button
      type="button"
      onClick={() => router.history.back()}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      ← 上一頁
    </button>
  )
}
