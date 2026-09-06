import { useState } from 'react'
import { clearBackup, readBackup } from '@/lib/storage'
import { useStore } from '@/hooks/useStore'

/**
 * 個人資料損毀後的提示。
 *
 * 沒有這個的話,使用者只會看到課表突然變空 —— 他不會知道發生什麼事,
 * 只會覺得網站弄丟了他的東西。壞掉的原始內容還留著,至少讓他下載回去自己看。
 */
export function RecoveryNotice() {
  /*
   * **順序很重要:** 備份是在 `loadStore()` 裡寫的,而那是第一次呼叫 `useStore()`
   * 時才發生。先讀備份的話,第一次載入永遠讀到 null —— 提示就永遠不會出現。
   *
   * 這裡順便訂閱 store:匯入資料之後狀態變了,提示也該跟著重算。
   */
  useStore()

  const [dismissed, setDismissed] = useState(false)
  // 每次 render 重讀而不是存進 state —— 免得「什麼時候該重新檢查」變成一個問題
  const backup = dismissed ? null : readBackup()

  if (backup === null) return null

  const download = () => {
    const blob = new Blob([backup], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ntut-course-web-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const dismiss = () => {
    clearBackup()
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="border-warning bg-warning/10 flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm"
    >
      <p className="flex-1">
        先前儲存的課表與收藏讀不出來，已經重置。原始內容還留著，可以下載回去看。
      </p>
      <button
        type="button"
        onClick={download}
        className="bg-card hover:bg-accent rounded-lg border px-3 py-1 text-xs"
      >
        下載原始內容
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-muted-foreground hover:bg-accent rounded-lg px-2 py-1 text-xs"
      >
        知道了
      </button>
    </div>
  )
}
