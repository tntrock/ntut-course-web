import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { syllabusProgressQueryOptions } from '@/hooks/useCourseDetail'
import { useMeta } from '@/hooks/useMeta'
import { API_BASE } from '@/lib/api'
import { formatTaipei } from '@/lib/datetime'
import { syllabusCoverage } from '@/lib/syllabus'

const SITE_REPO = 'https://github.com/tntrock/ntut-course-web'
const CRAWLER_REPO = 'https://github.com/tntrock/ntut-course-crawler'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

/**
 * 這一頁是**拿來讀的**，不是拿來掃的，所以排版規則和其他頁面不同：
 *
 * - 標題要明顯大於內文。同一個級數的話整頁會變成一根沒有分段的灰色長條。
 * - 內文用 `text-foreground/85` 而不是 `text-muted-foreground`。整頁都調暗
 *   等於沒有強調可言，`<strong>` 也就失去意義。灰色留給真正次要的東西。
 * - 行距 `leading-7`。中文沒有空白斷詞，行距不夠會黏成一片。
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-foreground/85 mt-3 space-y-3 text-[15px] leading-7">
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

/**
 * 一條已知限制：**粗體的結論 + 破折號 + 說明**。
 *
 * 七條用同一種強調方式，讀者才知道被標起來的東西代表什麼。結構是「只讀粗體也能
 * 讀完整段」，要細節再往下看。
 */
function Limit({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <li>
      <strong className="text-foreground font-semibold">{head}</strong>
      <span className="text-foreground/50"> —— </span>
      {children}
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-secondary text-foreground rounded px-1.5 py-0.5 text-[13px]">
      {children}
    </code>
  )
}

function AboutPage() {
  const { data: meta } = useMeta()

  /*
   * 大綱的涵蓋範圍**用算的，不寫死**。爬蟲正在往回逐期補，任何寫死的範圍都會在
   * 某一天悄悄變錯 —— 而且它讀起來仍然很合理，不會有人發現。
   *
   * 不用 suspense：這一頁的主體不該為了一句附註而空白。
   */
  const progress = useQuery(syllabusProgressQueryOptions(meta)).data
  const coverage = progress
    ? syllabusCoverage(
        progress,
        meta.semesters.map((s) => s.path),
      )
    : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">關於</h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-7">
        臺北科技大學的課程查詢：搜尋、教學大綱、系所與教師瀏覽、排課表。純靜態網站，沒有後端，也沒有帳號。
      </p>

      <Section title="免責聲明">
        {/* 讀 meta.disclaimer 而不是自己寫一份 —— 兩份文案遲早會不一致，
            而這一份是資料提供者的正式說法。它的標點沿用來源，不改。 */}
        <p className="text-foreground bg-secondary rounded-lg px-4 py-3">
          {meta.disclaimer}
        </p>
        <p>
          本站與國立臺北科技大學
          <strong className="text-foreground font-semibold">沒有任何關係</strong>
          ，是個人專案。選課、加退選、畢業學分請一律以學校公告與課程系統為準。
        </p>
      </Section>

      <Section title="資料從哪裡來">
        <p>
          資料由 <Out href={CRAWLER_REPO}>ntut-course-crawler</Out> 自動蒐集自
          <Out href={meta.source.url}>{meta.source.name}</Out>
          ，發布成靜態 JSON。本站只是讀那些檔案，不會即時連到學校系統。
        </p>
        <p>
          課表每 4 小時更新一次，教學大綱一天兩次。不過
          <strong className="text-foreground font-semibold">
            排定時間不等於實際執行時間
          </strong>
          ：GitHub Actions 只保證「不早於」，實測常遲 2 到 4
          小時。畫面上顯示的「資料時間」才是真的。
        </p>
        <p className="bg-secondary/60 text-foreground rounded-lg px-4 py-3 text-sm">
          目前這份資料產生於 {formatTaipei(meta.generated_at)}，收錄{' '}
          {meta.semesters.length} 個學期，最新是 {meta.latest}。
        </p>
      </Section>

      <Section title="已知限制">
        <ul className="space-y-3">
          <Limit head="只有上課時間表">
            暑期課程、學程修課規定、教室使用情形都不在範圍內。查得到「某個微學程有哪些課」，查不到「修完幾門才算完成」。
          </Limit>
          <Limit head="課號跨學期不通用">
            而且合開的課，各班級是不同課號（例如數位影像處理在資工四與資工所是兩個課號），備註欄會寫明。不要假設一門課只有一個課號。
          </Limit>
          <Limit head="修課人數是抓取當下的數字">
            會隨選課進度變動。歷史學期的數字是學期結束很久之後才抓的，等於最終定案值，不是當年選課期間的即時人數。
          </Limit>
          <Limit head="教學大綱只收錄近幾年">
            {coverage && coverage.oldest !== null ? (
              <>
                目前 {coverage.semesters.length} 個學期、
                {coverage.total.toLocaleString('zh-Hant')} 份，最舊到 {coverage.oldest}
                ，
              </>
            ) : (
              <>只有部分學期，</>
            )}
            更早的只有課表。大綱還在往回逐期補，範圍會跟著資料變。沒有大綱連結的課（跨校選課那類）本來就不會有。
          </Limit>
          <Limit head="沒有英文課名">
            課程列表與教學大綱頁都沒有這個欄位，目前無資料來源。
          </Limit>
          <Limit head="沒有進修部的獨立入口">
            實地確認過，總覽頁的單位裡沒有進修部。
          </Limit>
          <Limit head="舊學期的系所代碼對不起來">
            系所會改名、合併、裁撤，代碼也會被回收。跨學期比較要以各學期自己的對照表為準。
          </Limit>
        </ul>
      </Section>

      <Section title="你的資料存在哪裡">
        <p>
          課表、收藏與外觀設定
          <strong className="text-foreground font-semibold">
            只存在這台裝置的瀏覽器裡
          </strong>
          （localStorage），不會上傳到任何地方 —— 本站沒有伺服器可以存。
        </p>
        <p>
          代價是換裝置或清除瀏覽器資料就會不見。
          <Link to="/schedule" className="text-foreground underline underline-offset-4">
            課表頁
          </Link>
          底下有匯出 / 匯入 JSON，建議偶爾備份一份。
        </p>
      </Section>

      <Section title="資料是開放的">
        <p>
          crawler 發布的是公開的靜態 JSON，沒有金鑰、沒有速率限制，CORS
          全開。想自己做點什麼，直接拿去用就好：
        </p>
        <p>
          <code className="bg-secondary text-foreground rounded px-2 py-1 text-[13px] break-all">
            {API_BASE}/meta.json
          </code>
        </p>
        <p>
          <Code>meta.json</Code>{' '}
          會列出所有端點與目前收錄的學期，是所有其他請求的入口。完整說明在{' '}
          <Out href={CRAWLER_REPO}>crawler 的 README</Out>。
        </p>
        <details className="group">
          <summary className="text-foreground cursor-pointer text-sm select-none">
            看目前的 {meta.endpoints.length} 個端點
          </summary>
          {/* 兩欄對齊。排在同一行的話，每一行的說明會從不同的 x 座標開始，
              眼睛得一行一行重新找 */}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            {meta.endpoints.map((endpoint) => (
              <div key={endpoint.path} className="contents">
                <dt>
                  <Code>{endpoint.path}</Code>
                </dt>
                <dd className="text-muted-foreground self-center">
                  {endpoint.description}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>

      <Section title="原始碼">
        <p>
          網站：<Out href={SITE_REPO}>tntrock/ntut-course-web</Out>
          <span className="text-foreground/40 mx-2">·</span>
          爬蟲：<Out href={CRAWLER_REPO}>tntrock/ntut-course-crawler</Out>
        </p>
        <p>
          發現資料有錯、或哪裡怪怪的，歡迎開 issue。
          <strong className="text-foreground font-semibold">資料本身</strong>
          的問題開在 crawler 那邊，
          <strong className="text-foreground font-semibold">畫面</strong>
          的問題開在網站這邊。
        </p>
      </Section>
    </div>
  )
}
