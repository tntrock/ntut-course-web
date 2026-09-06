import { createFileRoute, Link } from '@tanstack/react-router'

import { useMeta } from '@/hooks/useMeta'
import { API_BASE } from '@/lib/api'
import { formatTaipei } from '@/lib/datetime'

const SITE_REPO = 'https://github.com/tntrock/ntut-course-web'
const CRAWLER_REPO = 'https://github.com/tntrock/ntut-course-crawler'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="text-muted-foreground mt-2 space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground underline underline-offset-4"
    >
      {children}
    </a>
  )
}

function AboutPage() {
  const { data: meta } = useMeta()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">關於</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        臺北科技大學的課程查詢:搜尋、教學大綱、系所與教師瀏覽、排課表。
        純靜態網站,沒有後端,也沒有帳號。
      </p>

      <Section title="免責聲明">
        {/* 讀 meta.disclaimer 而不是自己寫一份 —— 兩份文案遲早會不一致,
            而這一份是資料提供者的正式說法 */}
        <p className="text-foreground bg-secondary rounded-lg px-3 py-2">
          {meta.disclaimer}
        </p>
        <p>
          本站與國立臺北科技大學
          <strong className="text-foreground">沒有任何關係</strong>
          ,是個人專案。選課、加退選、 畢業學分請一律以學校公告與課程系統為準。
        </p>
      </Section>

      <Section title="資料從哪裡來">
        <p>
          資料由 <Out href={CRAWLER_REPO}>ntut-course-crawler</Out> 自動蒐集自{' '}
          <Out href={meta.source.url}>{meta.source.name}</Out>, 發布成靜態
          JSON。本站只是讀那些檔案,不會即時連到學校系統。
        </p>
        <p>
          課表每 4 小時更新一次,教學大綱一天兩次。
          <strong className="text-foreground">排定時間不等於實際執行時間</strong> ——
          GitHub Actions 只保證「不早於」,實測常遲 2 到 4 小時。
          畫面上顯示的「資料時間」才是真的。
        </p>
        <p className="text-foreground">
          目前這份資料產生於 {formatTaipei(meta.generated_at)}, 收錄{' '}
          {meta.semesters.length} 個學期,最新是 {meta.latest}。
        </p>
      </Section>

      <Section title="已知限制">
        <ul className="list-outside list-disc space-y-2 pl-5">
          <li>
            只涵蓋課程查詢系統的<strong className="text-foreground">上課時間表</strong>
            。暑期課程、學程修課規定、 教室使用情形都不在範圍內 ——
            查得到「某個微學程有哪些課」, 查不到「修完幾門才算完成」。
          </li>
          <li>
            <span className="text-foreground">課號跨學期不通用。</span>
            而且「合開」的課各班級是
            <strong className="text-foreground">不同課號</strong>
            (例如數位影像處理在資工四與資工所
            是兩個課號),備註欄會寫明。不要假設同一門課只有一個課號。
          </li>
          <li>
            <span className="text-foreground">修課人數是抓取當下的數字</span>,
            會隨選課進度變動。歷史學期的數字是學期結束很久後才抓的,
            等於最終定案值,不代表當年選課期間的即時人數。
          </li>
          <li>
            教學大綱<strong className="text-foreground">只涵蓋 110-1 以後</strong>
            ,更早的學期只有課表。 沒有大綱連結的課(跨校選課那類)本來就不會有大綱。
          </li>
          <li>
            <span className="text-foreground">沒有英文課名。</span>
            課程列表與教學大綱頁都沒有這個欄位,目前無資料來源。
          </li>
          <li>沒有進修部的獨立入口 —— 實地確認過總覽頁的單位裡沒有進修部。</li>
          <li>
            舊學期的系所代碼與現在
            <strong className="text-foreground">不一定對得起來</strong>
            。系所會改名、合併、裁撤,
            代碼也會被回收,跨學期比較要以各學期自己的對照表為準。
          </li>
        </ul>
      </Section>

      <Section title="你的資料存在哪裡">
        <p>
          課表、收藏與外觀設定
          <strong className="text-foreground">只存在這台裝置的瀏覽器裡</strong>
          (localStorage), 不會上傳到任何地方 —— 本站沒有伺服器可以存。
        </p>
        <p>
          代價是換裝置或清除瀏覽器資料就會不見。
          <Link to="/schedule" className="text-foreground underline underline-offset-4">
            課表頁
          </Link>
          底下有匯出 / 匯入 JSON,建議偶爾備份一份。
        </p>
      </Section>

      <Section title="資料你也可以直接用">
        <p>
          crawler 發布的是公開的靜態 JSON,沒有金鑰、沒有速率限制,CORS 全開。
          想自己做點什麼直接取用就好:
        </p>
        <p>
          <code className="bg-secondary text-foreground rounded px-1.5 py-0.5 text-xs break-all">
            {API_BASE}/meta.json
          </code>
        </p>
        <p>
          <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">meta.json</code>{' '}
          會列出所有端點與目前收錄的學期,是所有其他請求的入口。 完整說明在{' '}
          <Out href={CRAWLER_REPO}>crawler 的 README</Out>。
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer">看目前的端點清單</summary>
          <ul className="mt-2 space-y-1">
            {meta.endpoints.map((endpoint) => (
              <li key={endpoint.path}>
                <code className="bg-secondary text-foreground rounded px-1.5 py-0.5 text-xs">
                  {endpoint.path}
                </code>
                <span className="ml-2 text-xs">{endpoint.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section title="原始碼">
        <p>
          網站:<Out href={SITE_REPO}>tntrock/ntut-course-web</Out>
          <span className="mx-1.5">·</span>
          爬蟲:<Out href={CRAWLER_REPO}>tntrock/ntut-course-crawler</Out>
        </p>
        <p>
          發現資料有錯、或哪裡怪怪的,歡迎到 repo 開 issue。 資料本身的問題請開在 crawler
          那邊,畫面的問題開在網站這邊。
        </p>
      </Section>
    </div>
  )
}
