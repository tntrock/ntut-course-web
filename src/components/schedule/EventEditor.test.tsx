import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { EventEditor } from './EventEditor'
import { updateEvents } from '@/hooks/useEvents'
import { loadEvents, newEvent } from '@/lib/events'
import { PERIODS, slot } from '@/test/factories'

beforeEach(() => {
  localStorage.clear()
  updateEvents(() => ({}))
})

function fill(title: string, from: number, to: number) {
  fireEvent.change(screen.getByPlaceholderText('打工'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('起始節次'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('結束節次'), { target: { value: to } })
  fireEvent.click(screen.getByRole('button', { name: '加入' }))
}

describe('EventEditor', () => {
  it('沒有名稱就不加,並說明原因', () => {
    render(<EventEditor semester="115-1" events={[]} periods={PERIODS} />)
    fill('  ', 0, 0)
    expect(screen.getByText('請給這筆事務一個名稱。')).toBeInTheDocument()
    expect(loadEvents()).toEqual({})
  })

  it('起迄選反了直接換過來,存進該學期', () => {
    render(<EventEditor semester="115-1" events={[]} periods={PERIODS} />)
    fill('打工', 2, 0)

    const [saved] = loadEvents()['115-1'] ?? []
    expect(saved?.title).toBe('打工')
    expect(saved?.time_slots[0]?.periods).toEqual(['1', '2', '3'])
    // 成功後清空欄位,方便接著加下一筆
    expect(screen.getByPlaceholderText('打工')).toHaveValue('')
  })

  it('刪除只拿掉那一筆', () => {
    const keep = newEvent('社團', [slot(3, '4')], null)
    const drop = newEvent('打工', [slot(1, '1')], '晚班')
    updateEvents(() => ({ '115-1': [keep, drop] }))

    render(<EventEditor semester="115-1" events={[keep, drop]} periods={PERIODS} />)
    expect(screen.getByText(/週一 1 · 晚班/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '刪除 打工' }))
    expect(loadEvents()['115-1']?.map((e) => e.id)).toEqual([keep.id])
  })
})

describe('EventEditor 邊角情況', () => {
  it('學期沒有節次資料時講出來,不存一筆空的', () => {
    render(<EventEditor semester="115-1" events={[]} periods={[]} />)
    fireEvent.change(screen.getByPlaceholderText('打工'), { target: { value: '打工' } })
    fireEvent.click(screen.getByRole('button', { name: '加入' }))
    expect(screen.getByText('選不到節次。')).toBeInTheDocument()
    expect(loadEvents()).toEqual({})
  })

  it('存不下時講出來,欄位保留讓使用者再試', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    render(<EventEditor semester="115-1" events={[]} periods={PERIODS} />)
    fireEvent.change(screen.getByRole('combobox', { name: '星期' }), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByPlaceholderText('選填'), { target: { value: '晚班' } })
    fill('打工', 0, 1)

    expect(screen.getByText(/存不下來/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('打工')).toHaveValue('打工')
    expect(screen.getByPlaceholderText('選填')).toHaveValue('晚班')
    vi.restoreAllMocks()
  })
})
