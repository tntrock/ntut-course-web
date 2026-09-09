import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SourceLink } from './SourceLink'

describe('SourceLink', () => {
  it('連到學校原始頁面,並且在新分頁開啟', () => {
    const url =
      'https://aps.ntut.edu.tw/course/tw/ShowSyllabus.jsp?snum=364540&code=12391'
    render(<SourceLink url={url} />)

    const link = screen.getByRole('link', { name: /學校原始頁面/ })
    expect(link).toHaveAttribute('href', url)
    expect(link).toHaveAttribute('target', '_blank')
    // 開新分頁一定要配 noopener,不然對方拿得到 window.opener
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('沒有網址就什麼都不畫', () => {
    // 實測 115-1 抽樣 1,059 門課有 34% 沒有 syllabus_url —— 學校那邊就是沒有這一頁,
    // 自己拼一個網址出來只會連到壞掉的頁面
    const { container } = render(<SourceLink url={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
