/**
 * 「學校原始頁面」。
 *
 * 這個站是非官方的爬蟲資料,**一定要留一條回到學校頁面的路** —— 資料有疑問、
 * 或這裡還沒更新的時候,使用者要能自己去看原始的那一份。
 *
 * 沒有網址就整個不畫,不要自己拼一個出來:實測 115-1 抽樣 1,059 門課有 34%
 * 沒有 `syllabus_url`,那是學校那邊根本沒有這一頁,拼出來只會連到壞掉的頁面。
 */
export function SourceLink({ url }: { url: string | null | undefined }) {
  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      // 開新分頁一定要配 noopener,不然對方頁面拿得到 window.opener
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground inline-block text-xs underline underline-offset-4"
    >
      學校原始頁面
    </a>
  )
}
