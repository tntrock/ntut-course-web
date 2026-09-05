import { formatTaipei } from '@/lib/datetime'

/**
 * 資料來自離線快取時的提示。
 *
 * 明確講出資料是什麼時候的 —— 使用者在排課,拿到過期的加開 / 停開資訊
 * 比拿不到資料更糟。
 */
export function OfflineNotice({ generatedAt }: { generatedAt: string }) {
  return (
    <div
      role="status"
      className="bg-muted text-muted-foreground border-b px-4 py-2 text-sm"
    >
      目前連不上資料來源,顯示的是離線快取 —— 資料時間為 {formatTaipei(generatedAt)}。
    </div>
  )
}
