import { vi } from 'vitest'

type Listener = (event: { data: unknown }) => void

let handler: Listener | undefined
class FakeWorker {
  /** 正在處理訊息的那個 Worker。回覆要送回它,而不是最後建立的那個。 */
  static current: FakeWorker | undefined
  private listeners = new Set<Listener>()
  addEventListener(_type: 'message', listener: Listener) {
    this.listeners.add(listener)
  }
  postMessage(data: unknown) {
    queueMicrotask(() => {
      FakeWorker.current = this
      handler?.({ data })
    })
  }
  terminate() {
    this.listeners.clear()
  }
  emit(data: unknown) {
    for (const listener of this.listeners) listener({ data })
  }
}

/**
 * 讓 `search.worker.ts` 在測試的主執行緒裡跑。
 *
 * jsdom 沒有 `Worker`。與其另寫一份假的搜尋邏輯,不如把**真的** worker 模組
 * 載進來:它在 import 時對 `globalThis` 掛 `message` 監聽、回覆時呼叫
 * `globalThis.postMessage` —— 把這兩個接到假的 `Worker` 上,整條管線就是
 * 正式的那一條。
 *
 * 模組只會載入一次(之後是快取),所以監聽器要在第一次就留下來。
 * `vi.unstubAllGlobals()` 之後再呼叫一次即可重新接上。
 */
export async function installSearchWorker(): Promise<void> {
  if (!handler) {
    const realAdd = globalThis.addEventListener
    globalThis.addEventListener = ((type: string, listener: Listener) => {
      if (type === 'message') handler = listener
    }) as typeof globalThis.addEventListener
    try {
      await import('@/lib/search.worker')
    } finally {
      globalThis.addEventListener = realAdd
    }
  }
  vi.stubGlobal('postMessage', (data: unknown) => FakeWorker.current?.emit(data))
  vi.stubGlobal('Worker', FakeWorker)
}
