import { Chevron, SUMMARY_CLASS } from '@/components/ui/Disclosure'
import { createFileRoute } from '@tanstack/react-router'

import { useMeta } from '@/hooks/useMeta'
import { API_BASE } from '@/lib/api'
import { formatTaipei } from '@/lib/datetime'
import { STATIC_PAGES, pageHead } from '@/lib/seo'

const SITE_REPO = 'https://github.com/tntrock/ntut-course-web'
const CRAWLER_REPO = 'https://github.com/tntrock/ntut-course-crawler'

const CONTACTS = [
  { href: 'https://allenyen.net', label: 'allenyen.net', Icon: GlobeIcon },
  { href: 'mailto:Allen@info-sec.vip', label: 'Allen@info-sec.vip', Icon: MailIcon },
  { href: 'https://github.com/tntrock', label: 'github.com/tntrock', Icon: GitHubIcon },
  {
    href: 'https://www.linkedin.com/in/allenyentaiwan',
    label: 'linkedin.com/in/allenyentaiwan',
    Icon: LinkedInIcon,
  },
]

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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-secondary text-foreground rounded px-1.5 py-0.5 text-[13px]">
      {children}
    </code>
  )
}

/**
 * 一列聯絡方式。
 *
 * 圖示是裝飾,可讀的內容在文字裡 —— 所以 SVG 一律 `aria-hidden`,讀螢幕的人
 * 聽到的是「allenyen.net,連結」而不是「圖形,allenyen.net,連結」。
 */
function Contact({
  href,
  label,
  Icon,
}: {
  href: string
  label: string
  Icon: () => React.ReactElement
}) {
  // mailto 不能開新分頁 —— 交給郵件程式處理之後,那個空白分頁會留在原地
  const external = !href.startsWith('mailto:')

  return (
    <li className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">
        <Icon />
      </span>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="text-foreground underline-offset-4 hover:underline"
      >
        {label}
      </a>
    </li>
  )
}

/**
 * 線條圖示的共用屬性。跟 `ThemeToggle` 那組同一套:`currentColor` 才會跟著
 * 主題走,`aria-hidden` 因為文字已經說明了這是什麼。
 */
const STROKE = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function GlobeIcon() {
  return (
    <svg {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.6 3.7 5.7 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.7-3.7-9s1.3-6.4 3.7-9Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg {...STROKE}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 5.5L20.5 7" />
    </svg>
  )
}

/**
 * GitHub 與 LinkedIn 是**實心**的品牌標記,不是線條圖示 —— 這兩個商標本來就
 * 長這樣,描邊版本會認不出來。所以跟上面兩個不共用 `STROKE`。
 */
const BRAND = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
}

function GitHubIcon() {
  return (
    <svg {...BRAND}>
      <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.86 3.15 8.98 7.52 10.44.55.1.75-.24.75-.53v-1.87c-3.06.67-3.71-1.48-3.71-1.48-.5-1.28-1.22-1.62-1.22-1.62-1-.68.08-.67.08-.67 1.1.08 1.69 1.14 1.69 1.14.98 1.69 2.57 1.2 3.2.92.1-.71.39-1.2.7-1.48-2.44-.28-5.01-1.22-5.01-5.44 0-1.2.43-2.19 1.13-2.96-.11-.28-.49-1.4.11-2.92 0 0 .93-.3 3.03 1.13a10.5 10.5 0 0 1 5.52 0c2.1-1.43 3.03-1.13 3.03-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.76 1.13 2.96 0 4.23-2.58 5.16-5.03 5.43.4.34.75 1.02.75 2.06v3.05c0 .29.2.64.76.53a10.55 10.55 0 0 0 7.51-10.44C23.02 5.24 18.27.5 12 .5Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg {...BRAND}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

function AboutPage() {
  const { data: meta } = useMeta()

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">關於</h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-7">
        臺北科技大學的課程查詢：搜尋、教學大綱、系所與教師瀏覽、排課表。
        <br />
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
          <strong className="text-foreground font-semibold">沒有任何關係</strong>
          ，是個人專案。
          <br />
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
          crawler 發布的是公開的靜態 JSON，沒有金鑰、沒有速率限制，CORS 全開。
          <br />
          想自己做點什麼的話，直接拿去用就好：
        </p>
        <p>
          <code className="bg-secondary text-foreground rounded px-2 py-1 text-[13px] break-all">
            {API_BASE}/meta.json
          </code>
        </p>
        <p>
          <Code>meta.json</Code> 會列出所有端點與目前收錄的學期，是所有其他請求的入口。
          <br />
          完整說明在 <Out href={CRAWLER_REPO}>crawler 的 README</Out>。
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
        <p>發現資料有錯、或哪裡怪怪的，歡迎開 issue 給我。</p>
      </Section>

      <Section title="聯絡我">
        <ul className="space-y-3">
          {CONTACTS.map(({ href, label, Icon }) => (
            <Contact key={href} href={href} label={label} Icon={Icon} />
          ))}
        </ul>
      </Section>
    </div>
  )
}
