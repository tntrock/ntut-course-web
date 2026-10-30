import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, DEPARTMENTS } from '@/test/fixtures'
import { fetchMeta } from '@/lib/api'

/** 根版面與幾個靜態頁:首頁、關於、404、整站的載入失敗與離線快取。 */

const API = {
  ...BASE_API,
  '115-1/departments.json': {
    ...DEPARTMENTS,
    departments: [
      ...DEPARTMENTS.departments,
      {
        id: 'A1',
        name: '體育室',
        college: null,
        url: '',
        class_groups: [],
        course_count: 40,
        path: '',
      },
    ],
    colleges: [...DEPARTMENTS.colleges, { name: null, department_ids: ['A1'] }],
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('根版面', () => {
  it('首頁列出最新學期與校級單位,每頁都有免責聲明', async () => {
    stubApi(API)
    renderRoute('/')
    expect(await screen.findByRole('link', { name: /體育室/ })).toHaveAttribute(
      'href',
      '/dept/115-1/A1',
    )
    expect(screen.getAllByText(/115-1/).length).toBeGreaterThan(0)
    expect(screen.getByText('測試用免責聲明。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '關於' })).toHaveAttribute('href', '/about')
  })

  it('關於頁', async () => {
    stubApi(API)
    renderRoute('/about')
    await waitFor(() => expect(document.title).toContain('關於'))
    expect(
      screen.getByRole('link', { name: /github\.com\/tntrock$/ }),
    ).toBeInTheDocument()
  })

  it('不存在的網址', async () => {
    stubApi(API)
    renderRoute('/no-such-page')
    expect(
      await screen.findByRole('heading', { name: '找不到這個頁面' }),
    ).toBeInTheDocument()
  })

  it('資料來源回應錯誤時講出狀態碼,並說明不是使用者的網路', async () => {
    stubApi({ ...API, 'meta.json': { status: 503 } })
    renderRoute('/about')
    expect(await screen.findByText(/資料來源回應 HTTP 503/)).toBeInTheDocument()
  })

  it('完全連不上時請使用者檢查網路', async () => {
    stubApi(API)
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
    renderRoute('/about')
    expect(await screen.findByText(/連不上資料來源。請確認網路/)).toBeInTheDocument()
  })

  it('離線時改用快取,並標出資料時間', async () => {
    stubApi(API)
    await fetchMeta()
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))

    renderRoute('/about')
    expect(await screen.findByText(/顯示的是離線快取/)).toBeInTheDocument()
  })
})
