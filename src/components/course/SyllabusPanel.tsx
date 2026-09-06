import type { Syllabus } from '@/types/api'
import type { SyllabusState } from '@/lib/syllabus'
import { unknownSyllabusFields } from '@/lib/syllabus'
import { formatTaipei } from '@/lib/datetime'

/** 沒有內容時的說明。三種「沒有」的原因完全不同,不能都寫成「無資料」。 */
function Notice({
  title,
  detail,
  url,
}: {
  title: string
  detail: string
  url?: string | null
}) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">{detail}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          到學校原始頁面看看
        </a>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-4 first:border-t-0">
      <h3 className="text-muted-foreground mb-2 text-xs font-medium">{title}</h3>
      {children}
    </section>
  )
}

/** 老師填的內容常常靠換行排版,`whitespace-pre-wrap` 保住它。 */
function Text({ value }: { value: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item} className="whitespace-pre-wrap">
          {item}
        </li>
      ))}
    </ul>
  )
}

function Badges({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="bg-secondary text-secondary-foreground rounded px-2 py-1 text-xs"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function Loading() {
  return (
    <p className="text-muted-foreground px-4 py-10 text-center text-sm">載入大綱中…</p>
  )
}

export function SyllabusPanel({
  state,
  syllabus,
  syllabusUrl,
}: {
  /**
   * `null` 代表大綱進度還沒回來,狀態還算不出來。
   *
   * 大綱不擋整頁渲染,所以「還不知道」是正常的一刻 ——
   * 這時說「尚未收錄」是錯的,它會閃一下錯誤訊息再變成內容。
   */
  state: SyllabusState | null
  syllabus: Syllabus | undefined
  syllabusUrl: string | null
}) {
  if (state === null) return <Loading />

  if (state.kind === 'semester-not-covered') {
    return (
      <Notice
        title="本學期未收錄教學大綱"
        detail="本站只收錄了部分學期的大綱。這不代表這門課沒有大綱 —— 到學校系統仍然查得到。"
        url={syllabusUrl}
      />
    )
  }

  if (state.kind === 'no-syllabus') {
    return (
      <Notice
        title="這門課沒有教學大綱"
        detail="學校系統裡這門課就沒有大綱連結。班週會、體育、跨校選課多半屬於這種。"
      />
    )
  }

  // 「還沒抓到」是暫時的,「沒有大綱」是永久的 —— 說法必須分得開
  if (state.kind === 'pending') {
    return (
      <Notice
        title="大綱尚未收錄"
        detail="這門課有大綱，但本站還沒抓下來。大綱是分批抓取的，過一陣子再回來看。"
        url={syllabusUrl}
      />
    )
  }

  // 知道檔案在、只是還沒到 —— 這是載入中,不是「沒有」
  if (syllabus === undefined) return <Loading />

  if (!syllabus.has_content) {
    return (
      <Notice
        title="授課教師尚未填寫大綱"
        detail="大綱頁面存在，但內容是空的。這是老師還沒填，不是本站漏抓。"
        url={syllabus.url}
      />
    )
  }

  const unknown = unknownSyllabusFields(syllabus)

  return (
    <div>
      {syllabus.outline && (
        <Block title="教學目標">
          <Text value={syllabus.outline} />
        </Block>
      )}

      {syllabus.schedule && (
        <Block title="教學進度">
          <Text value={syllabus.schedule} />
        </Block>
      )}

      {syllabus.assessment && (
        <Block title="評量方式">
          <Text value={syllabus.assessment} />
        </Block>
      )}

      {syllabus.materials && (
        <Block title="教材">
          <Text value={syllabus.materials} />
        </Block>
      )}

      {syllabus.flexible_learning &&
        (syllabus.flexible_learning.category.length > 0 ||
          syllabus.flexible_learning.content) && (
          <Block title="彈性學習">
            {syllabus.flexible_learning.category.length > 0 && (
              <Badges items={syllabus.flexible_learning.category} />
            )}
            {syllabus.flexible_learning.content && (
              <div className="mt-2">
                <Text value={syllabus.flexible_learning.content} />
              </div>
            )}
          </Block>
        )}

      {syllabus.sdgs.length > 0 && (
        <Block title="永續發展目標（SDGs）">
          <Badges items={syllabus.sdgs} />
        </Block>
      )}

      {syllabus.ai_usage.length > 0 && (
        <Block title="生成式 AI 使用">
          <Badges items={syllabus.ai_usage} />
        </Block>
      )}

      {syllabus.extended_resources.length > 0 && (
        <Block title="延伸資源">
          <Bullets items={syllabus.extended_resources} />
        </Block>
      )}

      {syllabus.contact.length > 0 && (
        <Block title="聯絡方式">
          <Bullets items={syllabus.contact} />
          {syllabus.teacher_email && (
            <p className="mt-1 text-sm">
              <a
                href={`mailto:${syllabus.teacher_email}`}
                className="underline underline-offset-4"
              >
                {syllabus.teacher_email}
              </a>
            </p>
          )}
        </Block>
      )}

      {syllabus.notes && (
        <Block title="備註">
          <Text value={syllabus.notes} />
        </Block>
      )}

      {/* 學校加了新欄位時要看得見，不能默默吞掉 */}
      {unknown.map((field) => (
        <Block key={field.key} title={field.key}>
          {Array.isArray(field.value) ? (
            <Bullets items={field.value.map((v) => String(v))} />
          ) : (
            <Text value={String(field.value)} />
          )}
        </Block>
      ))}

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        {/* 兩個時間的意義不同，標籤要寫清楚：一個是老師改的，一個是我們抓的 */}
        <p>
          {syllabus.updated_at
            ? `教師最後更新 ${formatTaipei(syllabus.updated_at)}`
            : '教師未提供更新時間'}
          {/* 已凍結學期的記錄沒有 fetched_at(schema v3)——
              沒有就整段不印，不要留一個「本站抓取 」後面空白 */}
          {syllabus.fetched_at && (
            <>
              <span className="mx-1.5">·</span>
              本站抓取 {formatTaipei(syllabus.fetched_at)}
            </>
          )}
        </p>
        <a
          href={syllabus.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block underline underline-offset-4"
        >
          學校原始大綱頁
        </a>
      </footer>
    </div>
  )
}
