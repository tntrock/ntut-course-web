import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { DataTransfer, Favorites } from './PersonalData'
import { updateStore } from '@/hooks/useStore'
import { updateEvents } from '@/hooks/useEvents'
import { defaultStore, loadStore } from '@/lib/storage'
import { serializeBackup } from '@/lib/backup'
import { newEvent } from '@/lib/events'
import { renderInRouter } from '@/test/renderRoute'
import { course, savedCourse, slot } from '@/test/factories'

beforeEach(() => {
  localStorage.clear()
  updateStore(() => defaultStore())
  updateEvents(() => ({}))
})

afterEach(() => vi.restoreAllMocks())

describe('Favorites', () => {
  it('只列當期的收藏,離線時退回顯示課號', async () => {
    updateStore((s) => ({
      ...s,
      favorites: { ...s.favorites, courses: ['115-1:1', '115-1:2', '114-2:3'] },
    }))
    renderInRouter(
      <Favorites
        semester="115-1"
        courses={new Map([['1', course({ id: '1', name_zh: '微積分' })]])}
      />,
    )
    expect(
      await waitFor(() => screen.getByRole('link', { name: '微積分' })),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '3' })).toBeNull()
  })

  it('這學期沒有收藏就整段不畫', () => {
    const { container } = render(<Favorites semester="115-1" courses={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

function importFile(text: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, {
    target: { files: [new File([text], 'backup.json', { type: 'application/json' })] },
  })
}

describe('DataTransfer', () => {
  it('不是本站的檔案就說清楚,不動到現有資料', async () => {
    render(<DataTransfer />)
    importFile('not json')
    expect(await screen.findByText('這不是本站匯出的檔案。')).toBeInTheDocument()
  })

  it('較新版本的檔案明講讀不了,不硬吃', async () => {
    render(<DataTransfer />)
    importFile('{"version":999}')
    expect(await screen.findByText(/較新版本產生的/)).toBeInTheDocument()
  })

  it('匯入前要確認,取消就什麼都不改', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const backup = defaultStore()
    backup.schedules['115-1'] = { courses: [savedCourse({ id: '9' })] }

    render(<DataTransfer />)
    importFile(
      serializeBackup(backup, { '115-1': [newEvent('打工', [slot(1, '1')], null)] }),
    )

    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(confirm.mock.calls[0]?.[0]).toContain('1 門課與 1 筆個人事務')
    expect(loadStore().schedules['115-1']).toBeUndefined()
  })

  it('確認後覆蓋課表', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backup = defaultStore()
    backup.schedules['115-1'] = { courses: [savedCourse({ id: '9' })] }

    render(<DataTransfer />)
    importFile(serializeBackup(backup, {}))

    await waitFor(() =>
      expect(loadStore().schedules['115-1']?.courses.map((c) => c.id)).toEqual(['9']),
    )
  })
})

describe('DataTransfer 匯出與存檔失敗', () => {
  it('匯出 JSON 下載一份包含課表與事務的檔案', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    let downloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download
    })

    render(<DataTransfer />)
    fireEvent.click(screen.getByRole('button', { name: '匯出 JSON' }))
    expect(downloaded).toMatch(/^ntut-course-web-\d{4}-\d{2}-\d{2}\.json$/)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })

  it('「匯入 JSON」按鈕打開檔案選擇', () => {
    render(<DataTransfer />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const click = vi.spyOn(input, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: '匯入 JSON' }))
    expect(click).toHaveBeenCalled()
  })

  it.each([
    ['QuotaExceededError', '瀏覽器空間不足，匯入失敗。'],
    ['SecurityError', '這個瀏覽器不允許儲存資料。'],
  ])('課表存不下(%s)時講出原因', async (name, message) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Object.assign(new Error('nope'), { name })
    })
    render(<DataTransfer />)
    importFile(serializeBackup(defaultStore(), {}))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('課表存進去了但事務存不下時,說清楚是哪一半', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.endsWith('.events')) throw new Error('full')
      real.call(this, key, value)
    })
    render(<DataTransfer />)
    importFile(serializeBackup(defaultStore(), { '115-1': [] }))
    expect(
      await screen.findByText('課表已匯入，但個人事務存不下來。'),
    ).toBeInTheDocument()
  })
})
