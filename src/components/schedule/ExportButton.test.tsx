import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ExportButton } from './ExportButton'
import { downloadImage } from '@/lib/saveImage'

const toBlob = vi.fn<() => Promise<Blob | null>>()
vi.mock('html-to-image', () => ({ toBlob: () => toBlob() }))
vi.mock('@/lib/saveImage', () => ({
  canShareImage: () => false,
  downloadImage: vi.fn(),
  shareImage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom 沒有實作這兩個
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

function renderButton() {
  const ref = { current: document.createElement('div') }
  render(<ExportButton targetRef={ref} semester="115-1" />)
  fireEvent.click(screen.getByRole('button', { name: '存成圖片' }))
}

describe('ExportButton', () => {
  it('產生後先顯示預覽,再由使用者決定下載', async () => {
    const blob = new Blob(['png'])
    toBlob.mockResolvedValue(blob)
    renderButton()

    const dialog = await screen.findByRole('dialog', { name: '課表圖片' })
    expect(dialog.querySelector('img')).toHaveAttribute('src', 'blob:preview')
    // 不支援分享的瀏覽器不顯示分享按鈕
    expect(screen.queryByRole('button', { name: /分享/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '下載檔案' }))
    expect(downloadImage).toHaveBeenCalledWith(blob, '課表-115-1.png')
  })

  it('Esc 關閉預覽並回收網址', async () => {
    toBlob.mockResolvedValue(new Blob(['png']))
    renderButton()
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('截圖失敗要講出來,不能靜靜地沒反應', async () => {
    toBlob.mockRejectedValue(new Error('oom'))
    renderButton()
    expect(await screen.findByText(/產生圖片失敗/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '存成圖片' })).toBeEnabled()
  })
})
