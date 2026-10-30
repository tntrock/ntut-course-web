import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, DEPARTMENTS, SCOPED } from '@/test/fixtures'

const NOW = new Date('2026-09-13T12:00:00Z')

function changes(checkedAt: string, events: unknown[]) {
  return {
    schema_version: 3,
    generated_at: checkedAt,
    checked_at: checkedAt,
    event_count: events.length,
    events,
  }
}

const EVENTS = [
  {
    at: '2026-09-13T02:00:00Z',
    semester: '115-1',
    type: 'course_added',
    id: '1',
    name: '新開的課',
    teachers: ['王小明'],
    department_ids: ['59'],
    class_ids: ['2501'],
  },
  {
    at: '2026-09-12T02:00:00Z',
    semester: '114-2',
    type: 'baseline',
    course_count: 2717,
  },
]

function stub(checkedAt: string, events: unknown[]) {
  return stubApi({
    ...BASE_API,
    'changes.json': changes(checkedAt, events),
    '115-1/departments.json': DEPARTMENTS,
    '115-1/classes.json': {
      ...SCOPED,
      class_count: 1,
      classes: [{ id: '2501', name: '資工一甲' }],
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** 只假造 `Date`,計時器照常跑 —— 否則 React 與 router 的排程會停住。 */
function freeze() {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
}

describe('/changes', () => {
  it('依日期分組,代碼翻成中文名;baseline 不必為它抓對照表', async () => {
    freeze()
    const api = stub('2026-09-13T11:00:00Z', EVENTS)
    renderRoute('/changes')

    expect(await screen.findByRole('link', { name: '新開的課' })).toBeInTheDocument()
    // 對照表晚一步到,先顯示代碼、到了再換成名字
    const card = () => document.querySelector('article')?.textContent
    await waitFor(() => expect(card()).toContain('系所 資工系'))
    expect(card()).toContain('班級 資工一甲')
    expect(screen.getByText(/114-2 首次收錄/)).toBeInTheDocument()
    expect(api.calls.some((u) => u.includes('114-2/'))).toBe(false)
    expect(screen.queryByText(/已經超過 12 小時/)).toBeNull()
  })

  it('檢查時間太久以前時警告,並說明這比較像資料來源沒在跑', async () => {
    freeze()
    stub('2026-09-10T00:00:00Z', [])
    renderRoute('/changes')

    expect(await screen.findByText(/已經超過 12 小時/)).toBeInTheDocument()
    expect(screen.getByText(/（已過 84 小時）/)).toBeInTheDocument()
    expect(screen.getByText(/資料來源沒在跑/)).toBeInTheDocument()
  })

  it('剛檢查過但沒有事件 = 學校真的沒動', async () => {
    freeze()
    stub('2026-09-13T11:30:00Z', [])
    renderRoute('/changes')
    expect(await screen.findByText('近期無異動')).toBeInTheDocument()
    expect(screen.getByText(/學校這陣子沒有新增或停開課程/)).toBeInTheDocument()
  })
})
