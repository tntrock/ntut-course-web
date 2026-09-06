import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShareImage, downloadImage, shareImage } from './saveImage'

const png = new Blob(['x'], { type: 'image/png' })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('canShareImage', () => {
  it('沒有 canShare 就是不能分享', () => {
    // 桌面 Firefox 與舊瀏覽器沒有這個 API。不能分享就不要顯示分享按鈕
    vi.stubGlobal('navigator', {})
    expect(canShareImage()).toBe(false)
  })

  it('canShare 說不行就是不行', () => {
    vi.stubGlobal('navigator', { canShare: () => false })
    expect(canShareImage()).toBe(false)
  })

  it('canShare 丟例外時當成不能分享,不要讓整頁爆掉', () => {
    vi.stubGlobal('navigator', {
      canShare: () => {
        throw new Error('boom')
      },
    })
    expect(canShareImage()).toBe(false)
  })

  it('支援時回 true', () => {
    vi.stubGlobal('navigator', { canShare: () => true })
    expect(canShareImage()).toBe(true)
  })
})

describe('downloadImage', () => {
  it('用 blob URL 而不是 data URL', () => {
    // data: URL 正是 iOS Safari 接不住的那條路
    const create = vi.fn(() => 'blob:fake')
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    downloadImage(png, '課表-115-1.png')

    expect(create).toHaveBeenCalledWith(png)
    expect(click).toHaveBeenCalled()
  })
})

describe('shareImage', () => {
  it('成功時回 shared', async () => {
    vi.stubGlobal('navigator', { share: vi.fn(async () => {}) })
    expect(await shareImage(png, '課表.png')).toBe('shared')
  })

  it('使用者取消回 cancelled,不是失敗', async () => {
    // 取消是明確的意思表示,不該再跳一個錯誤訊息給他
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    vi.stubGlobal('navigator', {
      share: vi.fn(async () => {
        throw abort
      }),
    })
    expect(await shareImage(png, '課表.png')).toBe('cancelled')
  })

  it('其他錯誤回 failed', async () => {
    // Safari 離開使用者手勢太久會丟 NotAllowedError
    vi.stubGlobal('navigator', {
      share: vi.fn(async () => {
        throw new Error('NotAllowedError')
      }),
    })
    expect(await shareImage(png, '課表.png')).toBe('failed')
  })
})
