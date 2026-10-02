import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createLocalStore } from './localStore'

function setup(initial: number) {
  let stored = initial
  const load = vi.fn(() => stored)
  const save = vi.fn((value: number) => {
    stored = value
    return 'saved'
  })
  const store = createLocalStore('k', load, save, 'unchanged')
  return {
    store,
    load,
    save,
    setStored: (v: number) => (stored = v),
  }
}

describe('createLocalStore', () => {
  /** 重複加入同一門課就是這種情況 —— 不該寫入,也不該讓整頁重畫。 */
  it('updater 沒有改動時不寫入', () => {
    const { store, save } = setup(1)
    expect(store.update((v) => v)).toBe('unchanged')
    expect(save).not.toHaveBeenCalled()
  })

  it('有改動時寫入,並把寫入結果交給呼叫端', () => {
    const { store, save } = setup(1)
    expect(store.update((v) => v + 1)).toBe('saved')
    expect(save).toHaveBeenCalledWith(2)
  })

  /** 跨分頁同步:另一個分頁寫了同一個 key,這裡要重讀;別的 key 不理。 */
  it('只在自己的 key 被其他分頁改動時重讀', () => {
    const { store, setStored } = setup(1)
    const { result } = renderHook(() => store.use())
    expect(result.current).toBe(1)

    setStored(5)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other' }))
    })
    expect(result.current).toBe(1)

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k' }))
    })
    expect(result.current).toBe(5)
  })
})
