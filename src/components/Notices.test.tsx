import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { RecoveryNotice } from './RecoveryNotice'
import { UpdatePrompt } from './UpdatePrompt'
import { BACKUP_KEY, readBackup } from '@/lib/storage'

const sw = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(async () => {}),
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [false, () => {}],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('RecoveryNotice', () => {
  it('沒有損毀過就什麼都不顯示', () => {
    const { container } = render(<RecoveryNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('損毀過時提示,可下載原始內容,按「知道了」後清掉', () => {
    localStorage.setItem(BACKUP_KEY, '{broken')
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    render(<RecoveryNotice />)
    expect(screen.getByRole('alert').textContent).toContain('讀不出來')

    fireEvent.click(screen.getByRole('button', { name: '下載原始內容' }))
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')

    fireEvent.click(screen.getByRole('button', { name: '知道了' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(readBackup()).toBeNull()
  })
})

describe('UpdatePrompt', () => {
  it('沒有新版本時不顯示', () => {
    sw.needRefresh = false
    const { container } = render(<UpdatePrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('有新版本時由使用者決定更新或稍後', () => {
    sw.needRefresh = true
    render(<UpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: '稍後' }))
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false)
  })
})
