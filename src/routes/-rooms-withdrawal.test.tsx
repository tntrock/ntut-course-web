import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderRoute, stubApi } from '@/test/renderRoute'
import { BASE_API, META, SCOPED, SEMESTER } from '@/test/fixtures'
import { course } from '@/test/factories'

afterEach(() => vi.unstubAllGlobals())

describe('/rooms', () => {
  const API = {
    ...BASE_API,
    '115-1/schedule.json': {
      ...SCOPED,
      periods: META.periods,
      days: [
        {
          day: 1,
          day_name: '一',
          periods: [{ code: '1', course_count: 1, course_ids: ['busy'] }],
        },
      ],
    },
    '115-1/classrooms.json': {
      ...SCOPED,
      classroom_count: 3,
      classrooms: [
        { id: 'a', name: '三教101', course_count: 1, course_ids: ['busy'], url: '' },
        { id: 'b', name: '三教102', course_count: 0, course_ids: [], url: '' },
        { id: 'c', name: '綜科B01', course_count: 0, course_ids: [], url: '' },
      ],
    },
    'capacity.json': {
      schema_version: 3,
      classroom_count: 1,
      classrooms: { b: { name: '三教102', full_name: '', capacity: 80 } },
    },
  }

  it('框選時段後列出整段都沒課的教室,依大樓分組', async () => {
    stubApi(API)
    renderRoute('/rooms?slot=1-1')
    expect(await screen.findByText(/三教102/)).toBeInTheDocument()
    expect(screen.queryByText(/三教101/)).toBeNull()
    expect(screen.getByText(/綜科B01/)).toBeInTheDocument()
  })

  it('容量篩選不會把沒填座位數的教室丟掉', async () => {
    stubApi(API)
    renderRoute('/rooms?slot=1-1&seats=50')
    expect(await screen.findByText('未提供容量')).toBeInTheDocument()
    expect(screen.getByText(/且坐得下 50 人/)).toBeInTheDocument()
  })

  it('還沒選時段時給提示,不合法的參數直接忽略', async () => {
    stubApi(API)
    renderRoute('/rooms?seats=abc&sem=')
    expect(await screen.findByText('先在上面框選想要的時段。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '週一 第 1 節' }))
    expect(await screen.findByText(/三教102/)).toBeInTheDocument()
  })

  it('容量、時段格子與學期都能改,改時段時保留學期與容量', async () => {
    stubApi(API)
    renderRoute('/rooms?slot=1-1')
    await screen.findByText(/三教102/)

    fireEvent.change(screen.getByRole('combobox', { name: /至少坐得下/ }), {
      target: { value: '50' },
    })
    expect(await screen.findByText('未提供容量')).toBeInTheDocument()

    // 再點一次同一格 = 取消;保留 seats 的話提示文字就不會出現容量那一句
    fireEvent.click(screen.getByRole('button', { name: '週一 第 1 節' }))
    expect(await screen.findByText('先在上面框選想要的時段。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '週二 第 1 節' }))
    expect(await screen.findByText(/且坐得下 50 人/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /清除 1 格/ }))
    expect(await screen.findByText('先在上面框選想要的時段。')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: /至少坐得下/ }), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '115-1' } })
    expect(await screen.findByText('先在上面框選想要的時段。')).toBeInTheDocument()
  })

  it('選到的時段沒有完全空著的教室時,建議少選幾格', async () => {
    stubApi({
      ...API,
      '115-1/classrooms.json': {
        ...API['115-1/classrooms.json'],
        classrooms: [API['115-1/classrooms.json'].classrooms[0]],
      },
    })
    renderRoute('/rooms?slot=1-1')
    expect(await screen.findByText(/沒有完全空著的教室/)).toBeInTheDocument()
  })

  it('單一時段字串與陣列都收', async () => {
    stubApi({
      ...API,
      'capacity.json': BASE_API['capacity.json'],
    })
    renderRoute('/rooms?slot=1-1&slot=2-1')
    expect(await screen.findByText(/三教102/)).toBeInTheDocument()
  })
})

/**
 * 三個學期:115-1 有撤選資料,114-2 是舊格式(沒有「人」「撤」兩欄,要被排除並說明)。
 */
const SEMESTERS = [
  SEMESTER,
  { ...SEMESTER, year: 114, sem: 2, path: '114-2' },
  { ...SEMESTER, year: 114, sem: 1, path: '114-1' },
]
const W_META = { ...META, semesters: SEMESTERS }

/** 120 位老師,各一門課 —— 超過一頁的 100 筆才測得到「載入更多」。 */
const TEACHERS = Array.from({ length: 120 }, (_, i) =>
  course({
    id: `c${i}`,
    name_zh: `課程${i}`,
    teachers: [`老師${i}`],
    teacher_codes: [`t${i}`],
    enrolled: 60,
    withdrawn: i === 0 ? 40 : (i % 10) + 1,
  }),
)

const OLD = course({ id: 'old', teacher_codes: ['t0'], teachers: ['老師0'] })
delete (OLD as { enrolled?: number }).enrolled
delete (OLD as { withdrawn?: number }).withdrawn

const W_API = {
  ...BASE_API,
  'meta.json': W_META,
  '115-1/index.json': { semester: '115-1', courses: TEACHERS },
  '114-2/index.json': { semester: '114-2', courses: [OLD] },
  '114-1/index.json': { semester: '114-1', courses: [OLD] },
}

async function openWithdrawal(path = '/withdrawal') {
  stubApi(W_API)
  renderRoute(path)
  await screen.findByRole('heading', { name: '退選率', level: 1 })
}

describe('/withdrawal', () => {
  it('依退選率排名老師,比率旁附原始人次,連結帶上期間', async () => {
    await openWithdrawal()
    const top = await screen.findByRole('link', { name: /老師0/ })
    expect(top.textContent).toContain('40.0%')
    expect(top.textContent).toContain('撤 40 / 100 人')
    expect(top.getAttribute('href')).toContain('range=y3')
    // 舊格式的學期要講出來,不能默默少算
    expect(screen.getByText(/的原始課表沒有「人」「撤」兩欄/)).toBeInTheDocument()
    expect(screen.getByText('全校整體')).toBeInTheDocument()
  })

  it('一頁 100 筆,其餘按「載入更多」', async () => {
    await openWithdrawal('/withdrawal?group=none')
    await screen.findByRole('link', { name: /老師0/ })
    expect(screen.getByText('已顯示 100 / 120 位教師')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /載入更多/ }))
    expect(screen.getByText('已顯示 120 / 120 位教師')).toBeInTheDocument()
  })

  it('切到課程分頁,連到該學期的課程頁', async () => {
    await openWithdrawal()
    fireEvent.click(screen.getByRole('tab', { name: '課程' }))
    const link = await screen.findByRole('link', { name: /課程0/ })
    expect(link).toHaveAttribute('href', '/course/115-1/c0')
  })

  it('排序、分組、門檻與期間都會改網址;不依退選率排序時不給名次', async () => {
    await openWithdrawal()
    await screen.findByRole('link', { name: /老師0/ })

    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'name' } })
    fireEvent.change(screen.getByLabelText('分組'), { target: { value: 'none' } })
    fireEvent.change(screen.getByLabelText('最少修課人次'), {
      target: { value: '100' },
    })
    await waitFor(() =>
      expect(screen.getByText('已顯示 1 / 1 位教師')).toBeInTheDocument(),
    )
    const row = screen.getByRole('link', { name: /老師0/ })
    expect(within(row).queryByText('1')).toBeNull()

    fireEvent.change(screen.getByLabelText('期間'), { target: { value: 'sem' } })
    await waitFor(() =>
      expect(screen.queryByText(/的原始課表沒有「人」「撤」兩欄/)).toBeNull(),
    )
  })

  it('搜尋姓名,找不到時說明', async () => {
    await openWithdrawal()
    await screen.findByRole('link', { name: /老師0/ })

    fireEvent.change(screen.getByLabelText('搜尋'), { target: { value: '不存在' } })
    expect(await screen.findByText(/沒有符合條件的資料/)).toBeInTheDocument()
  })

  it('所選期間完全沒有撤選紀錄時,建議改看過去三年', async () => {
    await openWithdrawal('/withdrawal?sem=114-2&range=sem')
    fireEvent.click(await screen.findByRole('button', { name: '改看過去三年' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '改看過去三年' })).toBeNull(),
    )
  })

  it('有學期載入失敗時明講數字不完整', async () => {
    const { '114-1/index.json': _missing, ...rest } = W_API
    stubApi(rest)
    renderRoute('/withdrawal')
    expect(await screen.findByText(/有學期載入失敗/)).toBeInTheDocument()
  })

  it('彙總中顯示進度,所有期間另外提醒檔案大小', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fake = stubApi(W_API)
    vi.stubGlobal('fetch', async (input: string) => {
      if (input.includes('index.json')) await gate
      return fake(input)
    })
    renderRoute('/withdrawal?range=all')
    expect(await screen.findByText(/彙總中，已完成 0 \/ 3 個學期/)).toBeInTheDocument()
    expect(screen.getByText(/所有期間約 4 MB/)).toBeInTheDocument()
    release()
    expect(await screen.findByRole('link', { name: /老師0/ })).toBeInTheDocument()
  })
})
