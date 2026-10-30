import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { installSearchWorker } from '@/test/fakeWorker'
import { BASE_API, DEPARTMENTS, META } from '@/test/fixtures'
import { course, slot } from '@/test/factories'

/**
 * 搜尋頁整條跑:loader → 建索引(真的 worker 模組)→ 篩選 → 結果列表。
 *
 * 檔名的 `-` 前綴讓 TanStack Router 不把它當成路由。
 */

const COURSES = [
  course({
    id: '1',
    name_zh: '計算機概論',
    department_ids: ['59'],
    requirement_type: '校訂共同必修',
    required: true,
    credits: 3,
    time_slots: [slot(1, '1')],
  }),
  course({
    id: '2',
    name_zh: '英文寫作',
    language: '英語',
    requirement_type: '共同選修',
    credits: 2,
    time_slots: [slot(2, '1')],
  }),
]

const PERIODS = [
  { code: '1', start: '08:10', end: '09:00' },
  { code: '2', start: '09:10', end: '10:00' },
]

function stub() {
  return stubApi({
    ...BASE_API,
    'meta.json': { ...META, periods: PERIODS },
    '115-1/index.json': { semester: '115-1', courses: COURSES },
    '115-1/departments.json': DEPARTMENTS,
    '115-1/classrooms.json': { semester: '115-1', classroom_count: 0, classrooms: [] },
  })
}

afterEach(() => vi.unstubAllGlobals())

/** `unstubAllGlobals` 會連 Worker 一起拿掉,每個測試重新接上。 */
async function open(path: string) {
  await installSearchWorker()
  stub()
  renderRoute(path)
  await screen.findByText('門課', { exact: false })
}

const count = () =>
  screen.getByText('門課', { exact: false }).parentElement?.textContent

describe('/search', () => {
  it('建好索引後列出全部課程', async () => {
    await open('/search')
    await waitFor(() => expect(count()).toContain('2 門課'))
    expect(screen.getByText('計算機概論')).toBeInTheDocument()
    expect(screen.getByText('英文寫作')).toBeInTheDocument()
  })

  it('點選篩選條件會寫進網址並縮小結果,清除則全部拿掉', async () => {
    await open('/search')
    await waitFor(() => expect(count()).toContain('2 門課'))

    fireEvent.click(screen.getByRole('button', { name: '英語' }))
    await waitFor(() => expect(count()).toContain('1 門課'))
    expect(screen.getByText('已套用 1 個條件')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    await waitFor(() => expect(count()).toContain('2 門課'))
  })

  it('系所、必選修、時段、學分都能篩', async () => {
    await open('/search')
    await waitFor(() => expect(count()).toContain('2 門課'))

    fireEvent.click(screen.getByRole('button', { name: '資工系' }))
    await waitFor(() => expect(count()).toContain('1 門課'))
    fireEvent.click(screen.getByRole('button', { name: '資工系' }))

    fireEvent.click(screen.getByRole('button', { name: '共同選修' }))
    await waitFor(() => expect(screen.queryByText('計算機概論')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '共同選修' }))

    fireEvent.click(screen.getByRole('button', { name: '週一 第 1 節' }))
    await waitFor(() => expect(screen.queryByText('英文寫作')).toBeNull())
    fireEvent.click(screen.getByRole('radio', { name: '只在這些時段' }))
    fireEvent.click(screen.getByRole('button', { name: /清除 1 格/ }))
    await waitFor(() => expect(count()).toContain('2 門課'))

    fireEvent.change(screen.getByLabelText('最低學分'), { target: { value: '3' } })
    await waitFor(() => expect(count()).toContain('1 門課'))
    fireEvent.change(screen.getByLabelText('最高學分'), { target: { value: '2' } })
    await waitFor(() => expect(count()).toContain('0 門課'))
    fireEvent.change(screen.getByLabelText('最低學分'), { target: { value: '' } })
    await waitFor(() => expect(count()).toContain('1 門課'))
  })

  it('沒有結果時指出移除哪個條件會有結果', async () => {
    await open('/search?q=計算機&lang=英語')
    const [button] = await screen.findAllByRole('button', { name: /移除「/ })
    expect(screen.getByText('沒有符合條件的課')).toBeInTheDocument()

    fireEvent.click(button!)
    await waitFor(() => expect(screen.queryByText('沒有符合條件的課')).toBeNull())
  })

  /**
   * 回歸測試:頁首搜尋框的 debounce 還留著舊字,網址的 `q` 一被拿掉就又被
   * 寫回去 —— 「移除關鍵字」按了沒反應。
   */
  it('移除關鍵字之後,頁首搜尋框不會把它寫回網址', async () => {
    await open('/search?q=計算機&lang=英語')
    fireEvent.click(await screen.findByRole('button', { name: /移除「關鍵字」/ }))

    await waitFor(() => expect(count()).toContain('1 門課'))
    expect(screen.getByLabelText('搜尋課程')).toHaveValue('')
    // 等過 debounce 的 120ms,確定它沒有晚一步把 q 塞回來
    await new Promise((r) => setTimeout(r, 300))
    expect(count()).toContain('1 門課')
    expect(screen.getByText('英文寫作')).toBeInTheDocument()
  })

  /** 回歸測試:沒通過驗證的參數原本會以原字串留下來,`sem=` 讓 loader 找不到學期而炸掉。 */
  it('空的學期與不認得的排序直接忽略', async () => {
    await open('/search?sem=&sort=bogus')
    await waitFor(() => expect(count()).toContain('2 門課'))
    expect(screen.getByLabelText('排序')).toHaveValue('relevance')
  })

  it('在頁首輸入關鍵字會即時篩選', async () => {
    await open('/search')
    await waitFor(() => expect(count()).toContain('2 門課'))
    fireEvent.change(screen.getByLabelText('搜尋課程'), { target: { value: '英文' } })
    await waitFor(() => expect(count()).toContain('1 門課'))
  })

  it('拿掉任何一個條件都還是沒有結果時,給一般建議', async () => {
    // 英語課只有 2 學分、必修課不是英語 —— 三個條件兩兩都湊不出結果
    await open('/search?lang=英語&req=校訂共同必修&cmin=5')
    expect(await screen.findByText(/試著放寬幾個條件/)).toBeInTheDocument()
  })

  it('排序與手機版的篩選鈕', async () => {
    await open('/search?lang=英語')
    await waitFor(() => expect(count()).toContain('1 門課'))

    const toggle = screen.getByRole('button', { name: '篩選 1' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'credits' } })
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '115-1' } })
    await waitFor(() =>
      expect(within(document.body).getByText('英文寫作')).toBeVisible(),
    )
  })
})
