import { schemaWarning } from '@/lib/schema'

/**
 * 資料格式版本不符時的警告橫幅。
 *
 * 刻意做成**橫幅而非錯誤頁**:crawler 承諾新增欄位不升版,所以升版多半只影響
 * 部分欄位,把整站擋掉的代價遠大於顯示得不完整。
 */
export function SchemaWarning({ version }: { version: number }) {
  const message = schemaWarning(version)
  if (!message) return null

  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive border-destructive/20 border-b px-4 py-2 text-sm"
    >
      {message}
    </div>
  )
}
