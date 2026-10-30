import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { FavoriteToggle } from './FavoriteToggle'
import { ScheduleToggle } from './ScheduleToggle'
import { ThemeToggle } from './ThemeToggle'
import { updateStore } from '@/hooks/useStore'
import { defaultStore, loadStore } from '@/lib/storage'
import { course } from '@/test/factories'

const calculus = course({ id: '1', name_zh: '微積分' })

beforeEach(() => {
  localStorage.clear()
  updateStore(() => defaultStore())
})
afterEach(() => vi.restoreAllMocks())

describe('ScheduleToggle', () => {
  it('圖示版:加入再移除', () => {
    render(<ScheduleToggle course={calculus} semester="115-1" />)
    fireEvent.click(screen.getByRole('button', { name: '加入課表 微積分' }))
    expect(loadStore().schedules['115-1']?.courses.map((c) => c.id)).toEqual(['1'])

    const remove = screen.getByRole('button', { name: '從課表移除 微積分' })
    expect(remove).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(remove)
    expect(loadStore().schedules['115-1']?.courses).toEqual([])
  })

  it('按鈕版', () => {
    render(<ScheduleToggle course={calculus} semester="115-1" variant="button" />)
    fireEvent.click(screen.getByRole('button', { name: '加入課表' }))
    expect(screen.getByRole('button', { name: '已在課表' })).toBeInTheDocument()
  })

  it.each([
    ['QuotaExceededError', '瀏覽器空間已滿，存不下了'],
    ['SecurityError', '這個瀏覽器不允許儲存資料（無痕視窗？）'],
  ])('存不下(%s)時當下就講', (name, message) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('nope'), { name })
    })
    render(<ScheduleToggle course={calculus} semester="115-1" variant="button" />)
    fireEvent.click(screen.getByRole('button', { name: '加入課表' }))
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})

describe('FavoriteToggle', () => {
  it('收藏與取消收藏', () => {
    render(<FavoriteToggle semester="115-1" courseId="1" />)
    fireEvent.click(screen.getByRole('button', { name: '收藏' }))
    expect(loadStore().favorites.courses).toEqual(['115-1:1'])
    fireEvent.click(screen.getByRole('button', { name: '取消收藏' }))
    expect(loadStore().favorites.courses).toEqual([])
  })
})

describe('ThemeToggle', () => {
  it('依序切換 跟隨系統 → 淺色 → 深色 → 跟隨系統', () => {
    render(<ThemeToggle />)
    for (const label of ['淺色', '深色', '跟隨系統']) {
      fireEvent.click(screen.getByRole('button', { name: /外觀：/ }))
      expect(
        screen.getByRole('button', { name: `外觀：${label}，點擊切換` }),
      ).toBeVisible()
    }
    expect(loadStore().settings.theme).toBe('system')
  })

  it('跟隨系統時,系統切換外觀要即時反應;改成固定外觀後就不再聽', () => {
    const listeners = new Set<() => void>()
    const media = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList)

    render(<ThemeToggle />)
    expect(listeners.size).toBe(1)
    media.matches = true
    for (const fn of listeners) fn()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /外觀：/ }))
    expect(listeners.size).toBe(0)
  })
})
