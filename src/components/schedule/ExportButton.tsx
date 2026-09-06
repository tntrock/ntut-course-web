import { useEffect, useState } from 'react'

import { canShareImage, downloadImage, shareImage } from '@/lib/saveImage'

/**
 * 把課表存成 PNG。
 *
 * 截圖的是離屏那份固定寬度的版面,不是畫面上這一份 —— 畫面上的會跟著視窗寬度與
 * 深色主題變,匯出的圖不該這樣。
 *
 * **產生完先把圖顯示出來,再讓使用者決定怎麼存。** 直接觸發下載在 iOS Safari 上
 * 會安靜失敗(它跳出「檢視 / 下載」然後什麼都不做),使用者只會覺得按鈕壞了。
 * 圖出現在畫面上之後,至少長按就能存 —— 那條路每個平台都通。
 */
export function ExportButton({
  targetRef,
  semester,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>
  semester: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)

  const filename = `課表-${semester}.png`

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview.url)
  }, [preview])

  const generate = async () => {
    const node = targetRef.current
    if (!node) return

    setBusy(true)
    setError(null)
    try {
      const { toBlob } = await import('html-to-image')
      // 2 倍解析度,在手機上放大看也不糊
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff' })
      if (!blob) throw new Error('toBlob returned null')
      setPreview({ url: URL.createObjectURL(blob), blob })
    } catch {
      // 截圖會失敗(記憶體、瀏覽器差異),不能靜靜地什麼都沒發生
      setError('產生圖片失敗，可以改用瀏覽器截圖')
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!preview) return
    // 分享失敗就退回下載 —— 使用者按了按鈕,不能什麼都沒發生
    if ((await shareImage(preview.blob, filename)) === 'failed') {
      downloadImage(preview.blob, filename)
    }
  }

  return (
    <>
      <span className="relative">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="bg-card hover:bg-accent focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          {busy ? '產生中…' : '存成圖片'}
        </button>
        {error && (
          <span className="text-destructive absolute top-full right-0 mt-1 text-xs whitespace-nowrap">
            {error}
          </span>
        )}
      </span>

      {preview && (
        <PreviewDialog
          url={preview.url}
          onDownload={() => downloadImage(preview.blob, filename)}
          onShare={() => void share()}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

function PreviewDialog({
  url,
  onDownload,
  onShare,
  onClose,
}: {
  url: string
  onDownload: () => void
  onShare: () => void
  onClose: () => void
}) {
  // 進畫面時算一次就好,不會中途變
  const [canShare] = useState(canShareImage)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // 對話框開著時不要讓底下的頁面跟著捲
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="課表圖片"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-auto rounded-xl p-4"
      >
        <img src={url} alt="課表" className="w-full rounded-lg" />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-accent rounded-lg border px-3 py-1.5 text-sm"
          >
            關閉
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="hover:bg-accent rounded-lg border px-3 py-1.5 text-sm"
          >
            下載檔案
          </button>
          {/* 分享面板是 iOS 存進「照片」的正路;沒有這個 API 的瀏覽器就不顯示 */}
          {canShare && (
            <button
              type="button"
              autoFocus
              onClick={onShare}
              className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              分享 / 儲存到相簿
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
