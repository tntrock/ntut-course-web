import { describe, expect, it } from 'vitest'
import { checkSchema, schemaWarning } from './schema'
import { SUPPORTED_SCHEMA_VERSION } from '@/types/api'

describe('checkSchema', () => {
  it('版本相符時回報 ok', () => {
    expect(checkSchema(SUPPORTED_SCHEMA_VERSION)).toBe('ok')
  })

  it('crawler 升版後回報 newer', () => {
    expect(checkSchema(SUPPORTED_SCHEMA_VERSION + 1)).toBe('newer')
  })

  it('讀到更舊的版本時回報 older', () => {
    expect(checkSchema(SUPPORTED_SCHEMA_VERSION - 1)).toBe('older')
  })
})

describe('schemaWarning', () => {
  it('版本相符時沒有警告', () => {
    expect(schemaWarning(SUPPORTED_SCHEMA_VERSION)).toBeNull()
  })

  it('版本不符時給出可讀的訊息,並帶上兩邊的版本號', () => {
    const message = schemaWarning(SUPPORTED_SCHEMA_VERSION + 1)

    expect(message).toContain(String(SUPPORTED_SCHEMA_VERSION + 1))
    expect(message).toContain(String(SUPPORTED_SCHEMA_VERSION))
  })
})
