import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ExportImage } from './ExportImage'
import { courseItem, eventItem } from '@/lib/schedule'
import { newEvent } from '@/lib/events'
import { PERIODS, savedCourse, slot } from '@/test/factories'

const calculus = savedCourse({
  id: '1',
  name_zh: '微積分',
  credits: 3,
  time_slots: [slot(1, '1', '2')],
  classrooms: ['共同101'],
})
const assembly = savedCourse({ id: '2', name_zh: '班週會', credits: 0, time_slots: [] })
const saturdayJob = newEvent('打工', [slot(6, '3')], '晚班')

function renderImage(showWeekend: boolean) {
  const courses = [calculus, assembly]
  render(
    <ExportImage
      courses={courses}
      items={[...courses.map(courseItem), eventItem(saturdayJob)]}
      periods={PERIODS}
      semester="115-1"
      showWeekend={showWeekend}
      conflictKeys={new Set()}
    />,
  )
}

describe('ExportImage', () => {
  it('標題列出學期、門數與學分', () => {
    renderImage(false)
    expect(screen.getByText('115-1 課表')).toBeInTheDocument()
    expect(screen.getByText('2 門 · 3 學分')).toBeInTheDocument()
  })

  it('課與事務都畫進格子,帶出教室與備註', () => {
    renderImage(false)
    expect(screen.getByText('微積分')).toBeInTheDocument()
    expect(screen.getByText('共同101')).toBeInTheDocument()
    // 週六有事務就算沒開週末也要顯示那一欄
    expect(screen.getByText('週六')).toBeInTheDocument()
    expect(screen.getByText('晚班')).toBeInTheDocument()
  })

  it('沒有固定時段的課列在格子外,不能消失', () => {
    renderImage(false)
    expect(screen.getByText('未排入時段：').parentElement?.textContent).toContain(
      '班週會',
    )
  })
})
