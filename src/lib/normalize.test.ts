import { describe, expect, it } from 'vitest'
import { normalize, tokenize } from './normalize'

describe('normalize', () => {
  it('全形與半形括號正規化後相同', () => {
    // 實測 115-1:332 門課名用半形 `(一)`,31 門用全形 `(一)`,同類課程兩種寫法混用。
    // 使用者打哪一種都必須找得到另一種。
    expect(normalize('工程數學（一）')).toBe(normalize('工程數學(一)'))
  })

  it('全形英數轉成半形', () => {
    expect(normalize('ＡＩ２')).toBe('ai2')
  })

  it('英文一律轉小寫', () => {
    expect(normalize('Digital Image Processing')).toBe('digitalimageprocessing')
  })

  it('去掉空白,讓教師姓名中間的空白不影響比對', () => {
    // 實測有 `蘇  X`(中間兩個空白)這種姓名
    expect(normalize('蘇  轍')).toBe('蘇轍')
    expect(normalize('Keerthana K. B.')).toBe('keerthanakb')
  })

  it('全形空白也要去掉', () => {
    expect(normalize('資料　結構')).toBe('資料結構')
  })

  it('去掉標點,冒號與逗號不影響比對', () => {
    expect(normalize('專題研究:機器學習')).toBe(normalize('專題研究：機器學習'))
  })

  it('中文字保持原樣,不會被拆掉', () => {
    expect(normalize('數位影像處理')).toBe('數位影像處理')
  })

  it('空字串與 null 輸入不會爆掉', () => {
    expect(normalize('')).toBe('')
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

describe('tokenize', () => {
  it('用空白切成多個查詢詞', () => {
    expect(tokenize('白敦文 影像')).toEqual(['白敦文', '影像'])
  })

  it('連續空白不會產生空的查詢詞', () => {
    expect(tokenize('  白敦文   影像  ')).toEqual(['白敦文', '影像'])
  })

  it('每個查詢詞都會正規化', () => {
    expect(tokenize('ＡＩ 導論')).toEqual(['ai', '導論'])
  })

  it('全形空白也算分隔', () => {
    expect(tokenize('白敦文　影像')).toEqual(['白敦文', '影像'])
  })

  it('正規化後變空的查詢詞會被丟掉,不會讓所有課都命中', () => {
    // 使用者只打了標點時,不該把它當成「命中所有課」的空字串
    expect(tokenize('---')).toEqual([])
    expect(tokenize('')).toEqual([])
  })
})
