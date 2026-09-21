import { Chevron, SUMMARY_CLASS } from '@/components/ui/Disclosure'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { syllabusProgressQueryOptions } from '@/hooks/useCourseDetail'
import { useMeta } from '@/hooks/useMeta'
import { API_BASE } from '@/lib/api'
import { formatTaipei } from '@/lib/datetime'
import { syllabusCoverage } from '@/lib/syllabus'
import { STATIC_PAGES, pageHead } from '@/lib/seo'

const SITE_REPO = 'https://github.com/tntrock/ntut-course-web'
const CRAWLER_REPO = 'https://github.com/tntrock/ntut-course-crawler'

export const Route = createFileRoute('/about')({
  head: () => pageHead({ ...STATIC_PAGES['/about'], path: '/about' }),
  component: AboutPage,
})

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
        臺北科技大學的課程查詢：搜尋、教學大綱、系所與教師瀏覽、排課表。<br />
        純靜態網站，沒有後端，也沒有帳號。
      </p>

      <Section title="免責聲明">
        {/* 讀 meta.disclaimer 而不是自己寫一份 —— 兩份文案遲早會不一致，
            而這一份是資料提供者的正式說法。它的標點沿用來源，不改。 */}
        <p className="text-foreground bg-secondary rounded-lg px-4 py-3">
          {meta.disclaimer}
        </p>
        <p>
          本站與國立臺北科技大學
          <strong className="text-foreground font-semibold">沒有任何關係</strong>，是個人專案。<br />
          選課、加退選、畢業學分請一律以學校公告與課程系統為準。
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

      <Section title="資料是開放的">
        <p>
          crawler 發布的是公開的靜態 JSON，沒有金鑰、沒有速率限制，CORS 全開。<br />
          想自己做點什麼的話，直接拿去用就好：
        </p>
        <p>
          <code className="bg-secondary text-foreground rounded px-2 py-1 text-[13px] break-all">
            {API_BASE}/meta.json
          </code>
        </p>
        <p>
          <Code>meta.json</Code>{' '}
          會列出所有端點與目前收錄的學期，是所有其他請求的入口。<br />
          完整說明在{' '} <Out href={CRAWLER_REPO}>crawler 的 README</Out>。
        </p>
        <details className="group">
          <summary className={`text-foreground text-sm ${SUMMARY_CLASS}`}>
            <Chevron />
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
          發現資料有錯、或哪裡怪怪的，歡迎開 issue 給我。
        </p>
      </Section>
    </div>
  )
}
