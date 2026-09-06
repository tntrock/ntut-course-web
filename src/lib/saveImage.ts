/**
 * 把產生好的圖片交給使用者。
 *
 * **不要用 `data:` URL。** `toPng()` 回傳的是 base64 字串,一張 200 KB 的圖就是
 * 29 萬個字元 —— iOS Safari 的下載管理員接不住,會跳出「檢視 / 下載」的提示然後
 * 什麼都不做。`Blob` 加 `createObjectURL` 才是可靠的路。
 *
 * 分享與下載**兩個都給使用者,不自動選**。`canShare({ files })` 在桌機 Chrome
 * 也是 `true`,自動走分享會讓桌機使用者拿到分享面板而不是檔案;反過來在 iOS
 * 上下載又不一定會動。與其猜平台,不如兩條路都擺出來。
 */

/** 這個瀏覽器能不能分享檔案。不能的話就不要顯示分享按鈕。 */
export function canShareImage(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false
  }
  try {
    const probe = new File([new Blob([''])], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // 立刻回收會讓下載中斷,給瀏覽器一點時間把檔案接走
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export type ShareResult = 'shared' | 'cancelled' | 'failed'

/**
 * 叫出系統的分享面板。iOS 從那裡選「儲存影像」就會進照片。
 *
 * 使用者按取消**不算失敗** —— 那是明確的意思表示,不該再跳錯誤訊息給他。
 */
export async function shareImage(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    return 'failed'
  }
}
