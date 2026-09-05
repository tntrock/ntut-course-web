import { SUPPORTED_SCHEMA_VERSION } from '@/types/api'

export type SchemaCompatibility = 'ok' | 'newer' | 'older'

/**
 * 比對 crawler 回傳的 `schema_version` 與本站支援的版本。
 *
 * crawler 的承諾:新增欄位 / 新增端點不升版,移除欄位 / 改型別 / 改語意才升版。
 * 所以版本不符代表**可能有欄位的語意變了**,必須讓使用者知道 ——
 * 但仍要盡量把畫面渲染出來,不可白畫面(plan §1.4)。
 */
export function checkSchema(version: number): SchemaCompatibility {
  if (version === SUPPORTED_SCHEMA_VERSION) return 'ok'
  return version > SUPPORTED_SCHEMA_VERSION ? 'newer' : 'older'
}

/** 版本不符時的提示文字;相符時為 `null`。 */
export function schemaWarning(version: number): string | null {
  const status = checkSchema(version)
  if (status === 'ok') return null

  const shared = `資料格式為第 ${version} 版,本站支援第 ${SUPPORTED_SCHEMA_VERSION} 版。`
  return status === 'newer'
    ? `${shared}資料來源已更新,本站部分欄位可能顯示不正確,請回報。`
    : `${shared}讀到的是較舊的資料,部分功能可能無法使用。`
}
