import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SchemaWarning } from './SchemaWarning'
import { SUPPORTED_SCHEMA_VERSION } from '@/types/api'

describe('SchemaWarning', () => {
  it('版本相符時不顯示任何東西', () => {
    const { container } = render(<SchemaWarning version={SUPPORTED_SCHEMA_VERSION} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('版本不符時顯示警告,並標成 role="alert" 讓螢幕閱讀器讀到', () => {
    render(<SchemaWarning version={SUPPORTED_SCHEMA_VERSION + 1} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(String(SUPPORTED_SCHEMA_VERSION + 1))
  })
})
