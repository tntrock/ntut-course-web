# 北科課程網站 (ntut-course-web) — 開發規劃書

> 這份文件是本專案的完整開發規格與決策存檔。開發依階段順序推進,每個階段有明確的
> 驗收條件,未通過不進入下一階段。

> **文件狀態 (2026-09-05 建立)**
>
> - ✅ = 已對線上實際資料驗證過的事實
> - ❓ = 尚未驗證的推測,**不可當成已知條件**,遇到時要先確認再實作
>
> 本文件所有資料層的數字(檔案大小、課程數、欄位分佈)皆為 2026-09-05 對
> `https://tntrock.github.io/ntut-course-crawler/` 的實測值,非估算。

---

## 0. 專案目標

把 [`ntut-course-crawler`](https://github.com/tntrock/ntut-course-crawler) 產出的
靜態 JSON API,做成一個好用的北科課程查詢網站。

### 0.1 要做的

1. **查得到** — 關鍵字 + 多維篩選,搜尋反應要即時
2. **看得懂** — 課程詳情、教學大綱、教師 / 班級 / 系所 / 學程 / 教室的交叉瀏覽
3. **排得動** — 我的課表:加課、衝堂偵測、學分統計、匯出圖片
4. **知道變了** — 加開 / 停開 / 調課 / 換老師的異動流

### 0.2 明確不做的

| 不做                   | 原因                                                       |
| ---------------------- | ---------------------------------------------------------- |
| 後端伺服器、資料庫     | 資料是靜態 JSON,前端直接 fetch 即可                        |
| 使用者帳號、雲端同步   | 需要後端。個人資料存 localStorage,提供 JSON 匯出/匯入替代  |
| SSR / SSG 預渲染課程頁 | 14 萬門課無法預渲染,且資料每 4 小時變動                    |
| ICS 日曆匯出           | 需要校曆(學期起訖、停課補課日),crawler 無此資料來源。見 §8 |
| 選課功能、搶課輔助     | 非本專案範圍,且會對學校系統造成負擔                        |
| 課程評價 / 留言        | 需要後端與內容審核。可能另開專案                           |
| 退選率時間走勢圖       | `enrollment.json` 目前僅 1 個快照,資料不足。見 §8          |

### 0.3 技術棧

| 層   | 選用                                               | 理由                                                                                                           |
| ---- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 建置 | **Vite 7**                                         | 靜態輸出,建置快                                                                                                |
| 框架 | **React 19 + TypeScript**                          | 生態成熟,型別能把 crawler 的 schema 鎖住                                                                       |
| 路由 | **TanStack Router**                                | 檔案式路由 + **型別安全的 search params**。本站所有篩選條件都放在網址上(可分享、可回上一頁),這是它最關鍵的優勢 |
| 資料 | **TanStack Query**                                 | 請求去重、背景重取、載入/錯誤狀態。快取失效策略見 §2.2                                                         |
| 樣式 | **Tailwind CSS v4 + shadcn/ui**                    | 元件直接進 repo 可改,深色模式與可及性內建                                                                      |
| PWA  | **vite-plugin-pwa (Workbox)**                      | 只管 app shell,API 資料由自訂快取層處理(§2.2)                                                                  |
| 測試 | **Vitest + Testing Library**,e2e 用 **Playwright** |                                                                                                                |
| 部署 | **Cloudflare Pages**                               | 綁自訂網域與 Web Analytics 方便                                                                                |

**不使用**:任何需要付費的服務、任何後端執行環境(Cloudflare Functions 目前不用,
但保留為 §7 風險的退路)。

---

## 1. 資料來源契約

### 1.1 Base URL

```
https://tntrock.github.io/ntut-course-crawler/
```

以 `VITE_API_BASE` 環境變數注入,不寫死在程式碼裡 —— 未來若換 CDN 或加代理層
(§7 風險 1)只要改環境變數。

回應標頭已確認 ✅:

- `Access-Control-Allow-Origin: *` → 瀏覽器可直接跨網域 fetch,不需要 proxy
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: max-age=600` → GitHub Pages 的設定,**改不了**,快取策略必須自己做

### 1.2 實測傳輸成本 ✅

以下為 2026-09-05 帶 `Accept-Encoding: gzip` 的**實際傳輸 bytes**,不是原始檔大小。
這些數字是 §2 架構決策的依據。

| 端點                         |  gzip 傳輸 |   原始 | 用途                                   |
| ---------------------------- | ---------: | -----: | -------------------------------------- |
| `meta.json`                  | **2.4 KB** |  13 KB | 學期清單、節次時刻、必選修對照         |
| `115-1/index.json`           |  **83 KB** | 921 KB | 單一學期輕量索引,**搜尋的資料來源**    |
| `index.json`                 |     173 KB | 1.8 MB | 最新兩學期合併索引(本站不使用,見 §2.2) |
| `115-1/departments.json`     |     5.0 KB |  48 KB | 學院/系所/班級三層對照                 |
| `115-1/teachers.json`        |      15 KB |  89 KB | 教師清單                               |
| `115-1/classes.json`         |     6.4 KB |  70 KB | 班級清單                               |
| `115-1/programs.json`        |     4.1 KB |  16 KB | 學程 → 課號                            |
| `115-1/classrooms.json`      |     8.5 KB |  51 KB | 教室 → 課號                            |
| `115-1/schedule.json`        |      10 KB |  55 KB | 星期 × 節次 → 課號                     |
| `115-1/courses/59.json`      |     3.6 KB |  32 KB | 系所完整課程物件                       |
| `115-1/teachers/12095.json`  |     0.7 KB | 2.2 KB | 教師課表                               |
| `115-1/classes/2915.json`    |     1.0 KB | 4.0 KB | 班級課表                               |
| `115-1/syllabus/364893.json` |     2.5 KB | 4.6 KB | 單門課教學大綱                         |
| `changes.json`               |     0.8 KB | 2.9 KB | 異動事件流                             |
| `syllabus.json`              |      10 KB |  61 KB | 大綱抓取進度(用來算覆蓋率)             |

**關鍵結論**:

1. **首次進站冷啟動只需要 `meta.json` + `{semester}/index.json` = 85 KB**,
   全站搜尋即就緒。這比一張首頁大圖還小,所以「一次載完、全部在前端搜」是可行的,
   不需要伺服器端搜尋。
2. **整個瀏覽層(departments + teachers + classes + programs + classrooms)
   加起來只有 39 KB**,可以在 idle 時間背景預抓,讓所有下拉選單與交叉查詢瞬開。
3. 明細檔都在 1–4 KB,可以放心按需抓取。

### 1.3 已驗證的資料事實 ✅

實作時必須依照以下事實,**不可依直覺假設**。每一條都經過線上資料驗證。

#### 1.3.1 學期

- 共 **51 個學期**:`90-1` ~ `115-1`,合計 **141,018 門課**
- `meta.json` 的 `latest` = 目前最新學期(現為 `115-1`)。**絕對不可把學期寫死在前端**
- 所有學期的 `partial` 皆為 `false`(無不完整資料)
- 每個學期的 `generated_at` 是該學期資料的產生時間 —— **這是快取版本號的來源**(§2.2)
- ⚠️ `meta.semesters[]` 的欄位名是 `year` / `sem` / `path`,**沒有 `semester` 這個欄位**。
  學期字串(`"115-1"`)要讀 `path`。陣列由新到舊排序,`semesters[0]` 即為 `latest`,
  但仍應以 `meta.latest` 為準,不要依賴排序

#### 1.3.2 節次代碼順序

`periods` 已由 crawler 排好,**不是字典序**(字典序會把 `A` 排到 `9` 前面)。
直接用 `meta.json` 給的陣列順序,不要自己排:

```
1  08:10-09:00    2  09:10-10:00    3  10:10-11:00    4  11:10-12:00
N  12:10-13:00    5  13:10-14:00    6  14:10-15:00    7  15:10-16:00
8  16:10-17:00    9  17:10-18:00    A  18:30-19:20    B  19:20-20:10
C  20:20-21:10    D  21:10-22:00
```

共 14 節。課表格線就是這 14 列。

#### 1.3.3 必選修

`required` 是布林、`requirement_type` 是完整類別。**★ 和 ☆ 都是選修**,
差別在共同/專業,不是必/選 —— 篩選 UI 不能只做「必修/選修」兩個按鈕就了事:

| 符號 | `required` | `requirement_type` |
| ---- | ---------- | ------------------ |
| ○    | `true`     | 部訂共同必修       |
| △    | `true`     | 校訂共同必修       |
| ☆    | `false`    | 共同選修           |
| ●    | `true`     | 部訂專業必修       |
| ▲    | `true`     | 校訂專業必修       |
| ★    | `false`    | 專業選修           |

原始欄位空白時 `required` 是 `null`,**不是 `false`**。篩選時 `null` 要當第三態。

⚠️ **上表是完整的可能值,不是當期的實際值。** `115-1` 實測只出現其中 4 種,
且 `required` 全為布林、**沒有 `null`**:

| `requirement_type` |  課數 |
| ------------------ | ----: |
| 專業選修           | 1,029 |
| 校訂共同必修       |   813 |
| 校訂專業必修       |   794 |
| 共同選修           |    81 |

所以「部訂共同必修」「部訂專業必修」在 115-1 一門都沒有。篩選選項**必須由當期資料
動態產生**(掃 index 收 distinct 值),與 §1.3.4 的語言篩選同一原則 —— hard-code 六個
按鈕會讓使用者看到永遠是 0 筆的選項,而歷史學期若出現新值也會漏掉。
`null` 的三態處理仍要保留,因為舊學期可能有。

#### 1.3.4 授課語言是三態,不是布林 ✅

`115-1/index.json` 實測 2,717 門課:

| `language` 值 |  課數 |  佔比 |
| ------------- | ----: | ----: |
| `null`(中文)  | 2,218 | 81.6% |
| `英語`        |   488 | 18.0% |
| `中英雙語`    |    11 |  0.4% |

**篩選器必須做成三態**(中文 / 英語 / 中英雙語),不可寫成 `isEnglish` 布林。
`中英雙語` 這個值是實測才發現的,未來可能還有其他值 —— 篩選選項應由**資料動態產生**
(掃過 index 收集 distinct 值),不要 hard-code。

#### 1.3.5 教學大綱的三種狀態 ✅

`115-1` 實測:總課數 2,717、有 `syllabus_url` 的 1,909(70%)、已抓取 1,909(**100%**)。

剩下 **808 門(30%)的 `syllabus_url` 是 `null`** —— 班週會、體育、跨校選課等在學校
系統裡根本沒有大綱連結。這些課去抓 `{semester}/syllabus/{id}.json` 會拿到 **404**。

**但 `syllabus_url` 在完整課程物件裡,所以前端在載入課程時就知道有沒有大綱,
不必靠 404 判斷。** UI 必須做成三態:

> ⚠️ **2026-09-05 更正**:實作時發現實際是**四態**,而且 `syllabus.json` 的形狀
> 與本節記載不同(可以直接查表得知某門課的大綱在不在)。以**附錄 D.12 與 D.13**
> 為準,下面這張表已被取代。

| 狀態     | 判斷依據                           | UI                                         |
| -------- | ---------------------------------- | ------------------------------------------ |
| 沒有大綱 | 課程物件的 `syllabus_url === null` | **不顯示**大綱分頁                         |
| 老師未填 | 大綱檔的 `has_content === false`   | 顯示「授課教師尚未填寫大綱」+ 原始頁面連結 |
| 有內容   | `has_content === true`             | 正常渲染                                   |

抽樣 5 門(`360744` 國文、`362908` 物理、`364336` 基因工程學、`366048` 永續公民實踐、
`366570` 文化經濟研究專題)的 `has_content` 全為 `true`,
`outline` / `schedule` / `assessment` / `sdgs` 皆有實際內容(SDGs 標記 1~7 項不等)。

**只有 `115-1` 有大綱。** 實測 `114-2` 與 `110-1` 的大綱檔全部 404。
切換到舊學期時,大綱區塊要直接顯示「本學期未收錄教學大綱」,
**不可讓使用者一門一門點進去撞空**。

#### 1.3.6 教師以代碼為準,不是姓名 ✅

`115-1` 有 803 個教師代碼但只有 801 個不同姓名 —— **確實有同名老師**。
所有教師相關的連結、收藏、分組一律使用 `teacher_codes`,不可用 `teachers`(姓名)。
姓名只用來顯示。

#### 1.3.7 課號跨學期不穩定

課號在**單一學期內**唯一,但:

- 跨學期不是同一個號 —— 不能拿 115-1 的課號去 114-2 查
- 「合開」的課各班級是**不同課號**(資工四 `364893` vs 資工所 `364899`,
  `notes` 都寫「資工四和資工所合開」)

**設計後果**:收藏與我的課表必須以 `{semester}:{courseId}` 為 key,**各學期完全獨立**,
切換學期時不做任何遷移或推測。

#### 1.3.8 `quota` 已棄用

課程物件同時有 `enrolled` 和 `quota`,**值完全相同**,`quota` 是舊名。
本專案一律使用 `enrolled`。TypeScript 型別把 `quota` 標記為 `@deprecated`。

`enrolled` 是**修課人數**不是名額上限,UI 文案不可寫成「名額」。

#### 1.3.9 退選率的分母未定 ⚠️

crawler 的文件明確說明:學校沒有定義「人」欄是撤選前還是撤選後的人數,
從資料本身也判斷不出來。兩種算法在單一課程上差很多
(某門課 56.7% vs 36.2%)。

**本站的處理決策**:主要顯示 **「撤選 N 人 / 修課 M 人」的原始數字**,
退選率作為次要資訊顯示,並附上說明「分母定義未經學校確認,僅供參考」。
**不用退選率做預設排序**,避免給出看似精確實則不可靠的排名。

#### 1.3.10 空值

原始頁面用全形空白 `　`(U+3000)表示「沒有這個欄位」,crawler 已一律正規化成
`null`(陣列欄位是 `[]`)。前端不需要再處理全形空白,但**必須處理 `null`**。

`name_en` **永遠是 `null`**(無資料來源),不要在 UI 上留英文課名的位置。

### 1.4 相容性策略

每個 JSON 頂層都有 `schema_version`,目前是 **2**。crawler 的承諾是:

- 新增欄位、新增端點 **不升版** → 前端必須「忽略不認得的欄位」
- 移除欄位、改型別、改語意 **會升版**

**實作要求**:

1. 在 `src/lib/schema.ts` 定義 `SUPPORTED_SCHEMA_VERSION = 2`
2. 載入 `meta.json` 後檢查,不符時**顯示警告橫幅但仍嘗試渲染**
   —— 不可白畫面,也不可靜默忽略
3. TypeScript 型別只宣告用得到的欄位,新增欄位不會編譯失敗
4. **不做 runtime schema 驗證**(zod 之類)—— 會為了 2,717 筆資料付出可觀的解析成本,
   而 crawler 已有自己的測試。只在 `meta.json` 這種小檔上做基本檢查

---

## 2. 架構決策

### 2.1 為什麼是純靜態 SPA

資料是靜態 JSON、CORS 全開、每 4 小時更新一次。SSR 沒有任何優勢:

- **SEO**:14 萬門課無法預渲染。就算只渲染最新學期的 2,717 門,資料每 4 小時變,
  靜態建置追不上。而課程查詢的使用者幾乎都是直接來站上搜,不是從 Google 進來
- **首屏**:實測資料只有 85 KB,SPA 的首屏延遲主要來自 JS bundle,
  用 code splitting 解決比引入 SSR 划算
- **成本**:SSR 需要執行環境,靜態託管不需要

**結論**:Vite 靜態輸出 + Cloudflare Pages,`_redirects` 設 SPA fallback。

### 2.2 資料層:版本化快取

這是整個前端最重要的設計。要同時解決三個問題:

1. GitHub Pages 的 `Cache-Control: max-age=600` 改不了 —— 太短,舊學期資料明明永遠不變
2. 51 個學期的歷史資料應該永久快取,不該重複下載
3. PWA 要能離線使用

#### 策略

**用 `generated_at` 當版本號,附加在網址的 query string 上。**

```
GET {BASE}/115-1/index.json?v=2026-09-04T18:18:46Z
```

GitHub Pages 會忽略未知的 query string 照樣回傳檔案,但**瀏覽器與 Cache Storage
會把它當成不同的 URL** —— 於是:

- 版本沒變 → 命中快取,**零網路請求**
- 版本變了 → URL 不同,自動抓新的

版本號的來源:

| 資源                                               | 版本來源                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `meta.json`                                        | **不加版本,永遠 network-first**(僅 2.4 KB)。失敗時 fallback 到快取 |
| `{semester}/**`                                    | `meta.semesters[找到該學期].generated_at`                          |
| `changes.json`、`syllabus.json`、`enrollment.json` | `meta.generated_at`                                                |

**舊學期的 `generated_at` 永遠不變**,所以翻歷史資料只會下載一次,之後永久命中。
這一招同時解掉上面三個問題。

#### 實作

`src/lib/api.ts`:

```ts
const CACHE_NAME = 'ntut-api-v1'

async function fetchVersioned<T>(path: string, version: string): Promise<T> {
  const url = `${BASE}/${path}?v=${encodeURIComponent(version)}`
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(url)
  if (hit) return hit.json()
  const res = await fetch(url)
  if (!res.ok) throw new ApiError(res.status, path)
  await cache.put(url, res.clone())
  void evictOtherVersions(cache, path) // 清掉同路徑的舊版本
  return res.json()
}
```

- 直接用 **Cache Storage API**,不靠 service worker 的 runtime caching。
  理由:SW 的 runtime cache 很難表達「永久快取但版本一變就失效」,
  而且開發模式下 SW 通常關掉,自己做才能 dev / prod 行為一致
- `evictOtherVersions` 在背景刪掉同一路徑的舊版本,避免快取無限成長
- Cache Storage 不可用時(無痕視窗、舊瀏覽器)自動降級為直接 fetch,
  **功能不能因此壞掉**

#### 為什麼不用頂層 `index.json`

頂層 `index.json` 涵蓋最新兩個學期、gzip 173 KB。但本站的學期切換是明確的 UI 動作,
一次只搜一個學期,載 `{semester}/index.json`(83 KB)就夠。**省一半流量,而且
舊學期的路徑走同一套邏輯,不必為「最新兩學期」寫特例。**

### 2.3 搜尋:自己做,不引入搜尋庫

#### 決策

**用正規化後的 substring 比對,跑在 Web Worker。不引入 Fuse.js / MiniSearch / Orama。**

理由:

1. **中文沒有空白分詞**。Fuse.js 的模糊比對對中文會給出大量無關結果
   (它按字元計算編輯距離,中文每個字都是一個 token)。MiniSearch 要自寫 tokenizer,
   寫完效果也不會比 substring 好
2. **資料量根本不需要索引**。2,717 筆 × 3 個查詢詞的 `indexOf`,
   在手機上是 10 ms 等級。索引庫解決的是「10 萬筆以上」的問題,我們差兩個數量級
3. **零依賴、行為可預測**。使用者打「白敦文」就是找姓名含這三個字的,
   不會出現模糊比對的驚喜

#### 正規化

建索引時對每門課產生一個 haystack 字串:

```
NFKC 正規化 → 轉小寫 → 去除空白與標點
haystack = name_zh + teachers.join('') + requirement_type + id
```

NFKC 會把全形英數轉半形,解決「使用者打半形但資料是全形」的問題。

#### 查詢與排序

查詢字串按空白切成多個 token,**全部命中才算數(AND)**。排序權重:

| 命中位置     | 分數 |
| ------------ | ---: |
| 課名完全相等 | 1000 |
| 課名開頭     |  100 |
| 課名包含     |   50 |
| 教師姓名     |   30 |
| 課號         |   20 |
| 其他欄位     |   10 |

同分時按課名排序,確保結果穩定(不會因為資料順序變動而跳動)。

#### Worker

索引建立與查詢都在 Web Worker,主執行緒只傳查詢字串、收課號陣列。
輸入 debounce **120 ms**。

#### 備案(不先做)

若未來要做**跨學期搜尋**(51 個學期、14 萬門課),substring 掃描會不夠快。
屆時改用 **bigram 倒排索引**:把每個 haystack 切成連續二字組,建 `Map<string, number[]>`,
查詢時取交集。這是中文全文檢索的標準做法,不需要外部依賴。
**現在不做** —— MVP 一次只搜一個學期。

### 2.4 路由表

所有篩選條件放在 URL search params,**網址可分享、可加書籤、上一頁行為正確**。
這是選 TanStack Router 的主因(型別安全的 search param 驗證)。

| 路徑                                | 頁面                                              |
| ----------------------------------- | ------------------------------------------------- |
| `/`                                 | 首頁:搜尋框、我的課表摘要、收藏、最近異動摘要     |
| `/search`                           | 搜尋結果(條件全在 search params,見下)             |
| `/course/$semester/$courseId`       | 課程詳情(含大綱分頁)                              |
| `/dept/$semester/$deptId`           | 系所課表                                          |
| `/teacher/$semester/$teacherId`     | 教師課表                                          |
| `/class/$semester/$classId`         | 班級課表                                          |
| `/program/$semester/$programName`   | 學程課程                                          |
| `/classroom/$semester/$classroomId` | 教室課表                                          |
| `/browse`                           | 瀏覽入口(學院 → 系所 → 班級 / 教師 / 學程 / 教室) |
| `/schedule`                         | 我的課表                                          |
| `/changes`                          | 最近異動                                          |
| `/about`                            | 關於、資料來源、免責聲明、API 說明                |

`/search` 的 search params:

```ts
{
  q?: string            // 關鍵字
  sem?: string          // 學期,預設 meta.latest
  dept?: string[]       // 系所代碼
  college?: string      // 學院名(展開成 dept ids)
  req?: string[]        // requirement_type 完整值
  day?: number[]        // 0=日 ... 6=六
  period?: string[]     // '1'..'9','N','A'..'D'
  credits?: [number, number]
  lang?: 'zh' | 'en' | 'bilingual'
  program?: string
  classroom?: string
  teacher?: string      // 教師代碼
  class?: string        // 班級代碼
  sort?: 'relevance' | 'name' | 'credits' | 'enrolled'
  page?: number
}
```

陣列參數用重複 key 序列化(`?dept=59&dept=31`),不用逗號 —— 系所代碼可能含特殊字元。

### 2.5 localStorage 結構

單一 key `ntut-course-web:v1`,整包 JSON:

```jsonc
{
  "version": 1,
  "schedules": {
    "115-1": {
      "courses": [
        {
          "id": "364893",
          "addedAt": "2026-09-05T10:00:00Z",
          // 快照:離線時直接拿來畫課表,連線後與最新資料比對出異動
          "snapshot": {
            "name_zh": "數位影像處理",
            "teachers": ["白敦文"],
            "teacher_codes": ["12095"],
            "time_slots": [{ "day": 5, "periods": ["2", "3", "4"] }],
            "classrooms": ["六教727(e)"],
            "credits": 3.0,
            "department_ids": ["59"],
          },
        },
      ],
    },
  },
  "favorites": {
    "courses": ["115-1:364893"],
    "teachers": ["12095"],
  },
  "settings": { "theme": "system", "showWeekend": false },
}
```

**為什麼存快照而不只存課號**:

1. **離線可用** —— 沒網路時直接用快照渲染課表,不需要任何請求
2. **偵測異動** —— 連上線後把快照跟最新資料比對,課被停開、調課、換老師、
   改學分都能在課表上標出來。這正好把 crawler 的異動偵測能力接進使用者最在乎的地方

`version` 欄位為未來的結構遷移預留。讀取時 version 不符就走遷移函式,
無法遷移則保留原始資料另存 `ntut-course-web:v1.backup` 後重置,**絕不靜默丟掉**。

提供**設定頁的 JSON 匯出 / 匯入**,補償沒有帳號同步的缺口。

---

## 3. 功能規格

### 3.1 首頁 `/`

單一目的:**讓使用者三秒內開始搜尋**。

- 置中的大搜尋框,自動 focus(桌機),按 Enter 或即時顯示前 5 筆建議
- 學期選擇器(預設 `meta.latest`)
- 「我的課表」摘要卡:本學期已排幾門、幾學分、有無衝堂 → 點進 `/schedule`
- 「收藏」摘要卡:最近收藏的 3 門課 / 追蹤的老師
- 「最近異動」摘要:最新 3 筆事件 → 點進 `/changes`
- 頁尾:**必須顯示 `meta.json` 的 `disclaimer` 全文**,以及資料產生時間
  (`meta.generated_at`)與資料來源連結

首次進站沒有任何個人資料時,那兩張摘要卡不顯示空殼,改成一行功能說明。

### 3.2 搜尋 `/search`

#### 版面

桌機:左側篩選欄(sticky)+ 右側結果列表。
手機:篩選收進底部 sheet,頂部顯示「已套用 N 個條件」的橫向 chip 列。

#### 篩選器

| 篩選        | 資料來源                         | UI                                              |
| ----------- | -------------------------------- | ----------------------------------------------- |
| 關鍵字      | index 的 haystack                | 搜尋框                                          |
| 學期        | `meta.semesters`                 | 下拉(51 項,分「最近」與「歷年」兩組)            |
| 學院 / 系所 | `departments.json` 的 `colleges` | 兩層樹狀多選                                    |
| 必選修      | index 的 `requirement_type`      | 多選(6 個完整類別,不是必/選兩顆)                |
| 星期 / 節次 | index 的 `time_slots`            | **14×7 網格點選**(比兩個下拉好用得多)           |
| 學分        | index 的 `credits`               | 範圍滑桿                                        |
| 授課語言    | index 的 `language`              | 三態(中文 / 英語 / 中英雙語),選項由資料動態產生 |
| 學程        | `programs.json`                  | 下拉;選定後取 `course_ids` 建 Set 過濾          |
| 教室        | `classrooms.json`                | 下拉;同上                                       |
| 教師        | `teachers.json`                  | 可搜尋下拉,值是 `teacher_codes`                 |
| 班級        | `classes.json`                   | 可搜尋下拉                                      |

**時間篩選的語意要明確**:提供「包含這些時段」與「**只在這些時段**」兩種模式。
後者才是「幫我找星期五下午有空可以塞的課」這個真實需求。

#### 結果

- 虛擬捲動(`@tanstack/react-virtual`),2,717 筆全渲染會卡
- 每張卡片:課名 / 教師 / 時段 / 學分 / 必選修徽章 / 語言徽章 / 修課人數
- 右上角快捷:加入課表、收藏
- 空結果時列出「移除哪個條件會有結果」的建議(逐一移除單一條件重跑,取第一個有結果的)

#### 驗收

輸入到結果更新 **< 50 ms**(2,717 筆,中階手機)。

### 3.3 課程詳情 `/course/$semester/$courseId`

#### 資料取得

輕量索引沒有 `classrooms` / `notes` / `programs` / `syllabus_url`,所以詳情頁需要
**完整課程物件**。取得路徑:

1. 從記憶體中的 index 找到該課 → 取 `department_ids[0]`
2. 抓 `{semester}/courses/{deptId}.json`(gzip 3.6 KB)→ 找出該課

**冷啟動(直接開分享連結)**:index 還沒載入 → 先載 `{semester}/index.json`(83 KB)。
可接受。若日後覺得慢,解法見 §9(請 crawler 加 `lookup.json`)。

#### 內容

- 標題區:課名、課號、學分、時數、必選修徽章、語言徽章、階段
- 開課資訊:系所(連結)、班級(連結)、教師(連結,用 `teacher_codes`)、
  教室(連結,用 `classroom_codes`)、時段(渲染成迷你課表格)
- 人數:「修課 M 人・撤選 N 人」,退選率為次要資訊並附註分母未定(§1.3.9)
- `notes` 備註 —— **合開資訊在這裡**,要顯眼
- `programs` 所屬學程(連結)
- `audit`(隨班附讀)、`lab`(實驗/實習)有值才顯示
- 動作:加入課表 / 收藏 / 複製分享連結

#### 大綱分頁

依 §1.3.5 的三態處理。有內容時渲染:

`outline`(教學目標)、`schedule`(進度,保留換行)、`assessment`(評量)、
`materials`(教材)、`flexible_learning`(彈性學習)、`contact`、
`extended_resources`、`sdgs`(徽章)、`ai_usage`(徽章)、`notes`。

- **`extra` 欄位要渲染**,不要丟掉 —— crawler 把認不得的新欄位收在這裡,
  學校加新欄位時我們要看得到
- 顯示 `updated_at`(老師最後修改時間)與 `fetched_at`(我們抓取時間),
  兩者意義不同,標籤要寫清楚
- 舊學期直接顯示「本學期未收錄教學大綱」(§1.3.5)

### 3.4 瀏覽頁

`/browse` 是入口,四個分頁:**系所 / 教師 / 學程 / 教室**。

**班級不另開分頁** —— `departments.json` 本身就是「學院 → 系所 → 班級」三層結構
(`departments[].class_groups`),班級展開在系所底下才符合資料的形狀,也符合使用者
「先想到系、再想到年級」的心智模型。班級仍有獨立的明細頁 `/class/$semester/$classId`。

- **系所**:照 `departments.json` 的 `colleges` 分組,展開顯示底下的班級。`college` 為 `null` 的
  行政單位(教務處、體育室、通識中心、師培中心、校院級課程)獨立成一組
  「校級單位」,不要顯示成「null」
- **注意**:`C0` `C2` `C5` `C7` 這種「學院」單位掛的是**院級共同課程**,
  不是該學院所有系的集合。UI 上要標註,避免誤解
- **教師**:803 位,按姓名首字分組 + 搜尋框。每列顯示開課數與所屬系所
- **學程**:86 個,顯示課程數。學程只有中文名沒有代碼,路由參數要 encode
- **教室**:234 間,顯示課程數

明細頁(`/dept/...`、`/teacher/...`、`/class/...`)直接用對應的明細檔渲染,
一次請求就夠。`/program/...` 與 `/classroom/...` 只有課號,需與 index 交叉查詢。

### 3.5 我的課表 `/schedule`

#### 課表格

- 14 列(節次,順序照 `meta.periods`)× 週一~週五
- 週六日預設隱藏,有課或使用者開啟才顯示(`settings.showWeekend`)
- 每格顯示課名 + 教室,點擊開課程詳情
- 左側顯示節次代碼與起訖時間

#### 無時段課程

`time_slots` 為空的課(體育、班週會)**不會出現在格子裡**。
必須在表格下方獨立一區「未排入時段」列出,否則使用者會以為課掉了。

#### 衝堂偵測

建 `Map<"day-period", courseId[]>`,任一格 > 1 門即衝堂。
衝堂的格子與課程卡都標紅,頂部顯示「N 處衝堂」。**加課時不阻擋**,只警告
—— 使用者可能正在比較兩個方案。

#### 統計

總學分、必修/選修學分、每日課量長條、最早/最晚一堂。

#### 異動偵測

進頁面時把 `snapshot` 與最新資料比對:

| 情況                   | 標示                                        |
| ---------------------- | ------------------------------------------- |
| 課號在最新資料中不存在 | 🔴「此課已停開」+ 保留在課表但灰掉          |
| `time_slots` 不同      | 🟠「時段已異動」+ 顯示 舊 → 新,一鍵更新快照 |
| `teacher_codes` 不同   | 🟠「授課教師已更換」                        |
| `credits` 不同         | 🟠「學分數已異動」                          |

比對成功且無異動時靜默更新快照(教室、人數等會變的欄位)。

#### PNG 匯出

- 用 `html-to-image` 的 `toPng` 對一個固定寬度(1200px)的離屏 DOM 截圖
- **不使用 webfont**,全站中文用系統字型堆疊 —— 避免字型嵌入失敗導致 PNG 走樣
- 匯出圖含:學期、課表格、總學分、產生日期、站名浮水印
- ❓ 若實測字型在 Safari 走樣,改用 `<canvas>` 手繪(已列為 Phase 6 的風險項)

### 3.6 最近異動 `/changes`

讀 `changes.json`,依日期分組的時間軸。

| `type`                              | 呈現                                        |
| ----------------------------------- | ------------------------------------------- |
| `course_added`                      | 綠色「加開」+ 課名(連結)+ 系所 / 班級       |
| `course_removed`                    | 紅色「停開」                                |
| `course_changed`                    | 黃色「異動」+ **逐欄位 舊 → 新 的 diff 表** |
| `teacher_added` / `teacher_removed` | 教師增減 + 開課數                           |
| `baseline`                          | 灰色「首次收錄此學期」+ 課程數              |
| `bulk_change`                       | **特殊卡片**,見下                           |

#### `bulk_change` 卡片

實測資料確認有 `counts` / `by_department` / `by_class` / `samples`(10 筆)。渲染成:

- 標題:「一次異動 267 筆」+ `counts` 拆解(加開 265、停開 2)
- **依系所的橫條圖**:`by_department` 的代碼要用 `departments.json` 轉成中文名
  (`01` → 教務處、`14` → 通識中心)
- **依班級的橫條圖**:`by_class` 同理轉中文名(只有前 20 名)
- 展開後列出 10 筆 `samples`

分組集中在少數幾個單位 = 學校開了一批課;散落在幾十個系所 = 可能是解析器出問題。
**這個判讀方式要寫在卡片的說明文字裡**,讓使用者自己看得出來。

#### 重要的 UI 文案

- `at` 是**偵測到的時間,不是學校異動的時間**,實際異動在前一次抓取與這次之間
  (最多差 4 小時)。要標註
- `checked_at` 是今天但沒有新事件 = 學校真的沒動;`checked_at` 停在幾天前 = 爬蟲沒在跑。
  頁面頂部顯示「最後檢查:X」,超過 12 小時就變成警告色
- 只有**最新兩個學期**會產生事件,舊學期沒有。要說明

### 3.7 收藏

- 收藏課程:以 `{semester}:{courseId}` 為 key
- 追蹤老師:以 `teacher_codes` 為 key(**不是姓名**,§1.3.6)
- 首頁與 `/schedule` 都可看到
- 追蹤的老師若在 `changes.json` 有相關事件,首頁摘要要標出來

### 3.8 關於 `/about`

- 專案說明、原始碼連結(本站 + crawler)
- **完整免責聲明**(讀 `meta.disclaimer`,不要自己重寫一份)
- 資料來源與更新頻率說明
- 資料涵蓋範圍與已知限制(直接摘要 crawler README 的「已知限制」)
- 「本站資料由 crawler 提供,你也可以自己用」+ API base URL

---

## 4. 開發階段

每階段完成後才進下一階段。驗收條件不過不前進。

### Phase 0 — 專案骨架與資料層

**最重要的一階段**。資料層對了,後面都是拼裝。

1. `npm create vite`(react-ts)+ TypeScript 嚴格模式
2. Tailwind v4 + shadcn/ui 初始化,深色模式(`class` 策略 + 跟隨系統)
3. TanStack Router(檔案式)+ TanStack Query
4. `src/types/api.ts` — 依 §1 手寫 crawler 的 TypeScript 型別
5. `src/lib/api.ts` — §2.2 的版本化快取層
6. `src/lib/schema.ts` — schema_version 檢查
7. ESLint + Prettier + Vitest

**驗收**:

- [ ] `fetchMeta()` 拿得到 51 個學期,`latest` 為 `115-1`
- [ ] 同一份 `{semester}/index.json` 連抓兩次,**第二次零網路請求**(DevTools 驗證)
- [ ] `meta.generated_at` 改變後(可手動竄改測試)會重新下載
- [ ] Cache Storage 停用時仍能正常運作(降級路徑有測試覆蓋)
- [ ] `schema_version` 不符時顯示警告橫幅而非白畫面
- [ ] 型別測試:餵入含未知欄位的 JSON 不會編譯或執行失敗

### Phase 1 — 搜尋與篩選

1. Web Worker 搜尋引擎 + 正規化 + 評分
2. `/search` 頁面、篩選欄、虛擬捲動結果
3. search params 的型別安全序列化 / 反序列化
4. 空結果的條件建議

**驗收**:

- [ ] 「白敦文」找得到該教師的所有課
- [ ] 「digital」找得到含全形英數的課名(NFKC 生效)
- [ ] 語言篩選能分出 488 門英語 + 11 門中英雙語
- [ ] 「只在這些時段」模式正確排除跨出所選時段的課
- [ ] 複製網址到無痕視窗打開,篩選狀態完全一致
- [ ] 效能:輸入到結果更新 < 50 ms(2,717 筆)
- [ ] 單元測試涵蓋:正規化、評分排序、每一個篩選器的邊界(`null` 的 `required`、
      空 `time_slots`、`credits` 為 `null`)

### Phase 2 — 課程詳情與教學大綱

1. 完整課程物件的取得路徑(index → dept 檔)
2. 詳情頁版面
3. 大綱分頁的三態處理 + `extra` 欄位渲染

**驗收**(已完成,見附錄 D.12–D.16):

- [x] 有大綱的課(如 `364893`)完整顯示 outline / schedule / assessment / SDGs
- [x] `syllabus_url` 為 `null` 的課(808 門之一)**不顯示大綱分頁**,且不發出 404 請求
- [x] `has_content: false` 的課顯示「教師尚未填寫」而非空白 —— **實測 1,909 份
      大綱沒有一份是 `false`**,無法在畫面上點出來,改以元件測試涵蓋(見 D.14)
- [x] 切到 `114-2` 的課,大綱區顯示「本學期未收錄」 —— **2026-09-05 起 114-2 /
      114-1 / 113-2 已有大綱**,改為正常顯示內容(見 D.23)
- [x] 直接開 `/course/115-1/364893`(冷啟動)能正確載入
- [x] `notes` 的合開資訊有顯示

### Phase 3 — 瀏覽頁

1. `/browse` 四個分頁
2. 系所 / 教師 / 班級 / 學程 / 教室的明細頁
3. 全站交叉連結(課程 ↔ 教師 ↔ 系所 ↔ 教室 ↔ 學程)

**驗收**(已完成,見附錄 D.18–D.22):

- [x] `college` 為 `null` 的 5 個單位歸在「校級單位」,不顯示 null
- [x] 學院級單位(`C0` `C2` `C5` `C7`)有標註說明
- [x] 同名教師的兩個代碼是**兩個獨立頁面**,課不會混在一起
- [x] 學程名含特殊字元時路由正常(URL encode)
- [x] 從課程詳情點教室,能看到該教室的所有課

### Phase 4 — 我的課表與收藏

1. localStorage 儲存層 + 遷移機制 + 匯出/匯入
2. 課表格線、衝堂偵測、學分統計
3. 快照比對與異動標示
4. 收藏 / 追蹤老師

**驗收**:

- [ ] 加入兩門時段重疊的課,兩者都標紅且頂部顯示衝堂數
- [ ] `time_slots` 為空的課(如班週會)出現在「未排入時段」區,不會消失
- [ ] **關掉網路**重新整理,課表仍能從快照完整渲染
- [ ] 手動把快照的 `time_slots` 改掉,重新載入後顯示「時段已異動」與 舊 → 新
- [ ] 把課號改成不存在的值,顯示「此課已停開」且不崩潰
- [ ] localStorage 內容損毀(塞入非 JSON)時走備份重置流程,不白畫面
- [ ] 匯出的 JSON 能匯入回來,資料一致

### Phase 5 — 最近異動

1. 事件時間軸
2. `bulk_change` 卡片(含系所/班級橫條圖與樣本)
3. `checked_at` 新鮮度指示

**驗收**:

- [ ] 5 種事件型別都有對應的視覺
- [ ] `bulk_change` 的 `by_department` 代碼轉成中文名(`01` → 教務處)
- [ ] `course_changed` 的逐欄位 diff 正確顯示 舊 → 新
- [ ] `checked_at` 超過 12 小時顯示警告
- [ ] `changes.json` 為空事件時顯示「近期無異動」而非空白頁

### Phase 6 — PWA、匯出、打磨

1. `vite-plugin-pwa`,`registerType: 'prompt'`(顯示「有新版本」提示,
   **不用 autoUpdate** —— 使用者正在排課時換掉程式碼是很糟的體驗)
2. 離線橫幅:`meta.json` 抓不到時用快取並明示「離線模式・資料為 X」
3. PNG 匯出
4. 深色模式全站檢查
5. 無障礙:鍵盤操作、focus 樣式、對比度、`aria-label`

**驗收**:

- [ ] 可安裝到手機主畫面,圖示與啟動畫面正確
- [ ] 飛航模式下開站,搜尋過的學期仍可搜尋與瀏覽
- [ ] 離線橫幅正確顯示資料時間
- [ ] PNG 匯出的中文字型正常(Chrome / Safari / Firefox 各測一次)
- [ ] Lighthouse:Performance ≥ 95、Accessibility ≥ 95、Best Practices ≥ 95
- [ ] 全站可純鍵盤操作,搜尋 → 篩選 → 加入課表

### Phase 7 — 部署與上線

1. GitHub repo `tntrock/ntut-course-web`
2. Cloudflare Pages 接 Git,自動建置與 preview
3. 自訂網域 + Cloudflare Web Analytics
4. `_redirects` / `_headers`
5. README

**驗收**:

- [ ] push 到 main 自動部署成功
- [ ] PR 產生 preview 網址
- [ ] 直接開深層網址(`/course/115-1/364893`)不會 404(SPA fallback 生效)
- [ ] 自訂網域 HTTPS 正常
- [ ] Analytics 有數據進來
- [ ] 頁尾免責聲明可見

---

## 5. 部署設定

### Cloudflare Workers(Static Assets)

> ⚠️ **2026-09-05 更正**:Cloudflare 已把 Pages 併進 Workers。從 dashboard 接 Git
> 建立的是 **Worker**(部署命令 `npx wrangler deploy`),不是舊的 Pages 專案。
> 設定方式因此與原規劃不同。

| 設定             | 值                                                |
| ---------------- | ------------------------------------------------- |
| Build command    | `npm run build`                                   |
| Deploy command   | `npx wrangler deploy`                             |
| Output directory | `dist`(由 `wrangler.jsonc` 指定,dashboard 不必填) |
| Node version     | 由 `.nvmrc` 決定(22)                              |
| 環境變數         | `VITE_API_BASE`(可省略,程式碼有預設值)            |

### `wrangler.jsonc`

```jsonc
{
  "name": "ntut-course-web",
  "compatibility_date": "2026-09-03",
  "observability": { "enabled": true },
  "assets": {
    "directory": "dist",
    "not_found_handling": "single-page-application",
  },
}
```

**這個檔案必須進版控。** 沒有它,`wrangler deploy` 會在 CI 上跑互動式初始化,
並且多跑一次 build。

### SPA fallback:不要用 `_redirects`

原規劃的 `public/_redirects` 寫 `/*  /index.html  200` —— 在 Workers Static Assets
上**部署會直接失敗**:

```
Invalid _redirects configuration:
Line 2: Infinite loop detected in this rule.
```

Workers Assets 自己會處理 `.html` / `/index` 的解析,再加一條全域改寫會被判定成
無限迴圈。正解是 `assets.not_found_handling: "single-page-application"`。
已用 `wrangler dev` 實測 `/course/115-1/364893` 回傳 200 與 app 的 HTML。

`_headers` **仍然支援**,不受影響,繼續使用。

### `public/_headers`

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

`/assets/*` 是 Vite 產出的含 hash 檔名,可以永久快取。
`index.html` 不設,讓 Cloudflare 用預設的短快取。

**CSP**:需要允許 `connect-src` 到 GitHub Pages。等 Phase 7 實際測過再定,
先不寫死以免擋掉 Analytics beacon。

### 分析

Cloudflare Web Analytics —— 無 cookie、不追蹤個人,**不需要 cookie 同意橫幅**。
這是選它而非 GA 的主因。

---

## 6. 效能預算

| 指標                   | 目標                            |
| ---------------------- | ------------------------------- |
| JS bundle(gzip,首屏)   | < 150 KB                        |
| 首屏資料               | 85 KB(meta 2.4 + index 83)      |
| LCP(4G、中階手機)      | < 1.5 s                         |
| 搜尋輸入 → 結果更新    | < 50 ms                         |
| 二次進站(快取命中)     | 零資料請求(除 meta.json 2.4 KB) |
| Lighthouse Performance | ≥ 95                            |

超出預算時的處理順序:code splitting → 移除依賴 → 才考慮改架構。
**每個 Phase 結束都要量一次,不要等到 Phase 6 才發現超標。**

---

## 7. 已知風險與限制

| #   | 風險                         | 影響                       | 緩解                                                                                                                                          |
| --- | ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **GitHub Pages 是單點**      | 掛掉則全站無資料           | 離線快取讓已看過的資料仍可用;錯誤頁明確說明是資料來源問題而非本站。退路:加一層 Cloudflare Functions 代理(`VITE_API_BASE` 換掉即可,程式不用改) |
| 2   | `schema_version` 從 2 升到 3 | 欄位語意可能改變           | 啟動時檢查並顯示警告橫幅,仍嘗試渲染。升版時對照 crawler README 的 v3 說明再修                                                                 |
| 3   | **只有 115-1 有教學大綱**    | 舊學期大綱頁無內容         | 明確顯示「本學期未收錄」,不讓使用者白點                                                                                                       |
| 4   | 30% 的課沒有 `syllabus_url`  | 大綱分頁對這些課無意義     | 用 `syllabus_url === null` 判斷,不顯示分頁,不發 404 請求                                                                                      |
| 5   | 退選率分母未定               | 數字可能誤導               | 主顯示原始人數,退選率為次要並附註,不做預設排序                                                                                                |
| 6   | 課號跨學期不穩定             | 收藏/課表無法跨學期沿用    | 以 `{semester}:{courseId}` 為 key,各學期獨立,不做遷移                                                                                         |
| 7   | 個人資料只在 localStorage    | 換裝置、清瀏覽器資料就沒了 | 提供 JSON 匯出/匯入;首次使用時在設定頁說明                                                                                                    |
| 8   | 學校改版導致 crawler 抓不到  | 資料變空或殘缺             | 檢查 `meta.semesters[].failed_department_count > 0` 與 `partial`,在站上顯示提示                                                               |
| 9   | PNG 匯出的字型相容性 ❓      | Safari 可能走樣            | Phase 6 三瀏覽器實測;走樣則改 canvas 手繪                                                                                                     |
| 10  | 免責聲明的法律風險           | 使用者誤把非官方資料當官方 | 頁尾**每頁**顯示 `meta.disclaimer`,`/about` 完整說明,不可只放在關於頁                                                                         |

---

## 8. 未來可能(不進 MVP)

### ICS 日曆匯出

**前提:先解決校曆來源。** 需要學期起訖日期、國定假日停課、颱風假、補課日。
crawler 目前沒有這筆資料,課程查詢系統也不提供(在教務處行事曆那邊)。

兩條路:

1. 請 crawler 偵察教務處行事曆是否可爬,可行才實作
2. 本站維護一份 `public/semester-dates.json`,一學期人工更新一次

**在校曆問題解決前不做** —— 錯位一天的課表比沒有課表更糟。

### 其他

- **退選率時間走勢圖**:等 `enrollment.json` 累積足夠快照(目前僅 1 個)
- **跨學期搜尋**:需要 §2.3 的 bigram 倒排索引
- **課程歷年開課紀錄**:需要 §9 的 `course_key`
- **上課提醒**:PWA 的 Notification API,比 ICS 準(資料變動時我們知道,
  匯出的日曆不知道)
- **課程評價**:需要後端與內容審核,應另開專案

---

## 9. 對 crawler 的後續需求(全部可選)

以下都**不擋 MVP**,只在觸發條件成立時才值得做。全部是新增欄位/端點,
依 crawler 的相容性承諾**不需要升 `schema_version`**。

### 9.1 `{semester}/lookup.json` — 課號 → 系所代碼

**觸發條件**:若實測課程詳情頁的冷啟動(直接開分享連結)超過 1 秒。

現在冷啟動要先載 `{semester}/index.json`(gzip 83 KB)才知道該抓哪個系所檔。
一份 `{"364893": "59", ...}` 的對照表約 gzip 10 KB,能把冷啟動的資料量砍掉 8 成。
`schedule.json` / `programs.json` / `classrooms.json` 只給課號,也都受惠。

### 9.2 `teachers-all.json` — 跨學期教師總表

**觸發條件**:要做「這位老師歷年開過什麼課」。

現在得載 51 個 `{semester}/index.json`。一份
`{"12095": {"name": "白敦文", "semesters": ["115-1", "114-2", ...]}}` 就解決。
系所同理可加 `departments-all.json`。

### 9.3 穩定的 `course_key`

**觸發條件**:要做「這門課歷年的退選率 / 授課老師變化」。

需要 crawler 產生一個跨學期穩定的識別(正規化課名 + 系所 + 必選修類別)。
涉及判斷邏輯,成本明顯高於前兩項。

### 9.4 明確**不要**請 crawler 做的

- **不要「一門課一個檔」**。51 學期 × 平均 2,700 門 = 14 萬個檔案,
  會壓垮 GitHub Pages 與 git repo。小對照表才是正解
- **不要改既有欄位的名稱或語意**(尤其 `quota` / `enrolled`)
- **不要把人數變動塞進 `changes.json`** —— crawler 已論證過會淹掉真正的結構性異動

---

## 10. 決策存檔

| 決策     | 選了                                     | 沒選                     | 理由                                                    |
| -------- | ---------------------------------------- | ------------------------ | ------------------------------------------------------- |
| 渲染     | 純靜態 SPA                               | SSR / SSG                | 14 萬門課無法預渲染,資料每 4 小時變,首屏資料僅 85 KB    |
| 框架     | React + TanStack Router                  | Nuxt / SvelteKit / Astro | 型別安全的 search params 直接解決「篩選狀態要能分享」   |
| 搜尋     | 自寫 substring + Worker                  | Fuse.js / MiniSearch     | 中文無空白分詞,模糊比對結果差;2,717 筆不需要索引        |
| 索引來源 | `{semester}/index.json`                  | 頂層 `index.json`        | 省一半流量,舊/新學期走同一套邏輯                        |
| 快取     | 自寫 Cache Storage + `generated_at` 版本 | SW runtime caching       | 要表達「永久快取但版本變就失效」,且 dev/prod 行為要一致 |
| PWA 更新 | `prompt`                                 | `autoUpdate`             | 排課到一半被換掉程式碼是很糟的體驗                      |
| 課表儲存 | 課號 + 快照                              | 只存課號                 | 離線可渲染,且能比對出停開/調課/換老師                   |
| 匯出     | 只做 PNG                                 | PNG + ICS                | ICS 需校曆,crawler 無此資料;PNG 是學生真正常用的行為    |
| 退選率   | 顯示原始人數為主                         | 退選率為主要指標         | 分母定義未經學校確認,兩種算法在單課差距可達 20 個百分點 |
| 分析     | Cloudflare Web Analytics                 | Google Analytics         | 無 cookie,不需要同意橫幅,與 Pages 同一個後台            |
| 部署     | CF Pages Git 整合                        | GH Actions + wrangler    | 不必管 API token,PR preview 免設定                      |

---

## 附錄 A — 專案結構

```
ntut-course-web/
├── public/
│   ├── _redirects           # SPA fallback
│   ├── _headers             # 安全標頭與快取
│   └── icons/               # PWA 圖示
├── src/
│   ├── routes/              # TanStack Router 檔案式路由
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── search.tsx
│   │   ├── course.$semester.$courseId.tsx
│   │   ├── schedule.tsx
│   │   ├── changes.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts           # 版本化快取層 (§2.2)
│   │   ├── schema.ts        # schema_version 檢查
│   │   ├── storage.ts       # localStorage + 遷移 (§2.5)
│   │   ├── search.worker.ts # 搜尋引擎 (§2.3)
│   │   ├── normalize.ts     # NFKC 正規化
│   │   └── periods.ts       # 節次順序與時刻
│   ├── components/
│   │   ├── ui/              # shadcn/ui
│   │   ├── CourseCard.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── TimetableGrid.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useMeta.ts
│   │   ├── useSemesterIndex.ts
│   │   └── useSchedule.ts
│   └── types/
│       └── api.ts           # crawler schema 的 TypeScript 型別
├── plan.md                  # 本文件
└── README.md
```

## 附錄 B — 節次代碼順序常數

**不要自己排序**,直接用 `meta.json` 的 `periods` 陣列順序。
以下僅供閱讀參考(字典序會把 `A` 排到 `9` 前面,是錯的):

```
1, 2, 3, 4, N, 5, 6, 7, 8, 9, A, B, C, D
```

## 附錄 C — 資料驗證指令

開發過程中要重新確認資料事實時:

```bash
BASE=https://tntrock.github.io/ntut-course-crawler

# 學期清單與最新學期
curl -s $BASE/meta.json | python -c "import json,sys; m=json.load(sys.stdin); print(m['latest'], len(m['semesters']))"

# 授課語言分佈
curl -s $BASE/115-1/index.json | python -c "import json,sys,collections; print(collections.Counter(c.get('language') for c in json.load(sys.stdin)['courses']))"

# 大綱覆蓋率
curl -s $BASE/syllabus.json | python -c "import json,sys; [print(s) for s in json.load(sys.stdin)['semesters']]"

# 實際 gzip 傳輸大小
curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}\n' $BASE/115-1/index.json
```

---

## 附錄 D — 實作與規劃的偏離紀錄

規劃書寫於實作之前,以下是實際動手後與原規劃不同的地方。**以本節為準。**

### D.1 版本與工具鏈(Phase 0)

| §0.3 原訂         | 實際                              | 原因                                                                                                                            |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Vite 7            | **Vite 8**                        | `npm create vite` 的當前預設                                                                                                    |
| —                 | TypeScript 6                      | 同上。`baseUrl` 已棄用,`paths` 直接相對於 tsconfig                                                                              |
| ESLint + Prettier | **oxlint + Prettier**             | oxlint 是 Vite 樣板現在的預設,快很多。規則已針對路由檔豁免 `only-export-components`(檔案式路由一定要同時 export `Route` 與元件) |
| shadcn/ui(Radix)  | shadcn/ui **base-nova + Base UI** | shadcn 現行版本已改用 Base UI。`cn` 也改成同名的 npm 套件,取代 clsx + tailwind-merge                                            |

**TypeScript 嚴格度**比原訂更嚴:除 `strict` 外另開了
`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`。
另外樣板預設的 `erasableSyntaxOnly` 禁用建構子參數屬性,`ApiError` 因此改成
明寫欄位。

### D.2 `routeTree.gen.ts` 要進版控

`build` 是 `tsc -b && vite build`,型別檢查跑在 Vite 之前,而這個檔案平常由
Vite plugin 產生 —— CI 上沒有它會直接失敗。做法:檔案進版控,且 `build`
前先跑 `tsr generate`(`@tanstack/router-cli`)確保它是最新的。

### D.3 資料層的兩處調整

1. **`evictOtherVersions` 改成 `await`,不是 `void`。**
   §2.2 原本寫成背景執行。實際上它只是一次 `cache.keys()` 掃描,成本極低,
   而 fire-and-forget 會讓行為不可測(測試無從得知何時清完)。確定性優先。

2. **`fetchMeta()` 回傳 `{ data, fromCache }` 而非 `Meta`。**
   §6 的離線橫幅需要知道「這份 meta 是不是來自快取」,把它做進回傳值,
   比讓 UI 另外猜測乾淨。

### D.4 §1.3.3 必選修的補充

原表列的 6 種 `requirement_type` 是**可能值**,`115-1` 實測只出現 4 種,
且 `required` 全為布林、沒有 `null`。篩選選項必須由當期資料動態產生,
詳見該節已補上的說明。

### D.5 端點包裝函式採需要時才加

`lib/api.ts` 目前只有 `fetchMeta` / `fetchVersioned` / `fetchSemesterIndex` /
`semesterVersion`。departments、teachers、classrooms 等包裝**刻意不預先寫**
—— 它們都是 `fetchVersioned` 的一行包裝,等 Phase 3 真的用到時連同測試一起加,
避免現在寫一堆沒有測試涵蓋、也沒人呼叫的程式碼。

### D.6 部署目標其實是 Workers,不是 Pages

§0.3 與 §10 都寫「Cloudflare Pages」。實際從 dashboard 接 Git 時,Cloudflare 建立的
是 **Worker + Static Assets**,部署命令是 `npx wrangler deploy`。第一次部署因此失敗
—— `_redirects` 的 SPA 規則在 Workers Assets 上是不合法的。§5 已整段更正。

對本專案的實質影響:

- **`_redirects` 刪除**,SPA fallback 改由 `wrangler.jsonc` 的
  `not_found_handling` 處理
- **`wrangler.jsonc` 進版控**,否則 CI 上會跑互動式初始化並重複 build
- `_headers` 不受影響
- §10 決策表裡「CF Pages Git 整合 vs GH Actions + wrangler」的結論仍然成立
  —— 只是 Git 整合現在產生的是 Worker。PR preview 仍然有

### D.7 時段篩選改用「格子」而非星期 × 節次的交叉乘積

§2.4 原訂 `day?: number[]` 與 `period?: string[]` 兩個獨立陣列,但 §3.2 的 UI 是
14×7 網格點選。兩者不相容:使用者點了「週五第 2 節」與「週三第 7 節」時,
交叉乘積會把「週五第 7 節」「週三第 2 節」也算進去 —— 那是錯的。

改成直接存格子:`?slot=5-2&slot=3-7`,格式 `{星期}-{節次}`。已有測試涵蓋
「格子是獨立的,不會變成交叉乘積」這條性質。

### D.8 §4 Phase 1 的「digital」驗收條件無法成立

原驗收寫「『digital』找得到含全形英數的課名(NFKC 生效)」。實測 115-1 的
2,717 門課,**課名裡沒有任何一門含 `digital`**(全形或半形都沒有),
這條無從測起。

實際存在而且更值得測的是括號:`(一)` 有 **332 門用半形**、**31 門用全形**,
同類課程兩種寫法混用。使用者打哪一種都必須兩種都找到。已改用這個案例驗收,
實測兩種寫法都得到 25 筆。

全形英數的正規化仍然保留(只有 3 門課名含全形英數字母),NFKC 也一併處理了
全形括號,所以功能沒有縮水,只是驗收案例換成資料裡真的有的。

### D.9 時段顯示不能無腦取頭尾

`週五 2-4` 這種縮寫在節次不連續時會說謊 —— `2、4` 寫成 `2-4` 等於宣稱包含
第 3 節。實作改成找出連續的區段分別縮寫,並且連續與否是依 `meta.periods` 的
順序判斷(`4` 的下一節是 `N` 不是 `5`,`9` 的下一節是 `A`)。

### D.10 排序改用共用的 Intl.Collator

`String.prototype.localeCompare` 每次呼叫都要重建定序物件。2,717 筆排序會呼叫
三萬次以上,實測最差情況(空查詢、全部課程)要 29.7ms —— 桌機就用掉 §6 效能預算
的六成,中階手機必定超標。改用模組層級共用的 `Intl.Collator` 後降到 **4.7ms**。

### D.11 索引與系所對照要並行取得

交給元件裡的 suspense 各自去抓時,冷快取下會排成瀑布:
`meta` → `index.json` → `departments.json`,三段串行約 945ms。
兩份資料都只依賴 `meta`,沒有理由排隊。

改在路由 loader 裡用 `Promise.all` 並行取得後,實測兩者同時在 228ms 發出,
搜尋就緒時間降到約 457ms。`loaderDeps` 只帶 `sem` —— 其餘篩選條件都在前端算,
不該讓它們觸發重新載入。

### D.12 `syllabus.json` 的實際形狀與 §1 記載不同

§1 把 `syllabus.json` 的 `fetched` 記成「已抓取的門數」(`number`)。實測是
**巢狀物件**:`{ "115-1": { "364893": "2026-09-05T06:21:43Z", … } }` ——
學期 → 課號 → 該門大綱的抓取時間。門數在 `semesters[]` 裡另有一份。

這個差異不是筆誤而已,它讓兩件事變得可行:

1. **不必靠 404 判斷有沒有大綱。** 檔案抓到了才會進這份對照,所以「這門課的大綱
   在不在」查表就知道。原本只能靠 `syllabus_url` 推測。
2. **大綱可以有自己的快取版本號。** 老師改大綱時學期索引不會重新產生,用學期的
   `generated_at` 當版本號會讓修訂過的大綱永遠取到舊的那份。改用該門課自己的
   抓取時間就精準了。

### D.13 教學大綱是四態,不是三態

§1.3.5 列了三態(沒有大綱 / 老師未填 / 有內容)。加上「**有大綱連結但 crawler
還沒抓到**」才完整 —— 大綱正在補齊的期間這是常態,和「這門課根本沒有大綱」是
完全不同的意思,混在一起會讓使用者以為體育課和還沒抓到的必修課是同一回事。

四態與判斷依據:

| 狀態            | 判斷依據                                         | UI                             |
| --------------- | ------------------------------------------------ | ------------------------------ |
| 本學期未收錄    | `syllabus.json` 的該學期 `fetched` 為 0 或不存在 | 說明 + 學校原始頁連結          |
| 沒有大綱        | `syllabus_url === null`                          | **不顯示**大綱分頁             |
| 尚未收錄        | 有 `syllabus_url` 但不在 `fetched` 對照裡        | 說明「分批抓取中」+ 原始頁連結 |
| 有內容 / 未填寫 | 大綱檔的 `has_content`                           | 正常渲染 / 「教師尚未填寫」    |

**「本學期未收錄」完全由資料決定,沒有把 `115-1` 寫死在程式裡。** crawler 正在
補其他學期的大綱,寫死的話資料補上的當天就會變成錯的。

實測 115-1:2,717 門課中 1,909 門在 `fetched` 對照裡,808 門不在 ——
與 `syllabus_url` 為 `null` 的門數**完全一致**,兩個來源互相印證。

### D.14 §3.3 的 `extra` 欄位在 schema v2 不存在

§3.3 要求「`extra` 欄位要渲染」。實測 115-1 全部 1,909 份大綱**沒有任何一份有
`extra`** —— schema v2 是平鋪的,沒有這個包裝。

但那條要求背後的目的是對的(學校加新欄位時我們要看得見),所以改成更廣的做法:
渲染**所有型別沒宣告的頂層欄位**,並額外支援 `extra` 這種包裝形式。兩種都涵蓋,
而且不依賴一個目前不存在的欄位。

同一次全掃還發現:**1,909 份大綱裡沒有一份 `has_content` 是 `false`**,也沒有
任何一門課停在「尚未收錄」。也就是說 §4 Phase 2 的兩條驗收條件在瀏覽器裡
**點不出來**。這兩個分支改以 `SyllabusPanel` 的元件測試涵蓋 —— 等哪天真的出現
這種課,畫面已經是對的。(同 D.8 的處理原則:驗收條件跟不上真實資料時,
換成能真正驗證的做法,並把原因寫下來。)

### D.15 時段同時給節次代碼與實際時刻

§3.3 寫「時段渲染成迷你課表格」。單一課程只有一兩個時段,放進 14×7 的格子裡
九成以上是空的,手機上尤其浪費。改成一行一個時段,節次代碼旁邊附上實際時刻
(`週五 2-4　09:10–12:00`)—— 代碼對排課的人是熟語,對第一次看的人不是,兩個都給。

時刻的分段規則與 D.9 相同:`2、4` 要顯示成 `09:10–10:00、11:10–12:00`,
併成一段等於謊稱中間那節也要上課。

### D.16 詳情頁的交叉連結先連回搜尋

系所 / 教師 / 教室 / 學程的專頁是 Phase 3。在那之前:

- **系所**連到 `/search?dept=<id>`,**教師**連到 `/search?q=<姓名>` —— 兩個都是
  現在就成立的頁面
- 教師用姓名搜尋而非代碼,是因為那是一次**搜尋**,不宣稱同名的兩位老師是同一個人
  (§1.3.6)。真正以 `teacher_codes` 識別的專頁留給 Phase 3
- **教室**與**學程**沒有對應的篩選條件,先以純文字呈現,不做假連結

### D.17 詳情頁的請求排程:逐項解鎖,大綱不擋渲染

線上冷快取實測課程詳情頁 **1,347ms** —— 超過 §9 訂的 1 秒門檻。拆開來看:

| 輪次 | 請求                                                            | 耗時            |
| ---- | --------------------------------------------------------------- | --------------- |
| 1    | `meta.json`(含連線建立)                                         | 473 → 870ms     |
| 2    | `index.json` ∥ `syllabus.json`                                  | 873 → 1,108ms   |
| 3    | `courses/59.json` ∥ `departments.json` ∥ `syllabus/364893.json` | 1,112 → 1,347ms |

**三個來回本身就要約 700ms**,這是「沒有 `lookup.json`」的固有成本:要拿到系所
代碼就得先載整份索引。真正的解法在 §9(請 crawler 加一份課號 → 系所的對照)。

在那之前先把排程榨乾,兩處調整:

1. **每個請求在自己的相依項回來的當下就發出**,不等同一輪的其他人。用
   `Promise.all` 分輪的話,系所檔要等比較慢的 `syllabus.json`,白等約 100ms。
   `departments.json` 只依賴 `meta`,也因此從第三輪提前到第二輪。
2. **大綱不進 loader 的 `await`。** 課程資訊分頁不需要它,而它是最後才回來的
   那個。讓它擋著等於為了一個多數人不會馬上看的分頁,拖慢所有人的首次渲染。
   面板自己顯示「載入大綱中…」。

連帶要求:元件端的大綱進度**不能用 suspense**,否則等於把它擋回去。大綱分頁
要不要顯示因此改成只看 `syllabus_url`(那是課程物件的欄位,已經在手上),
不等進度表 —— 否則分頁會晚一拍才冒出來。

### D.18 `departments.json` 有兩處與 §1 記載不同

1. **`class_groups` 是物件陣列不是字串陣列。** 每個元素是 `{id, name, url}`。
   型別記成 `string[]` 的話,班級連結根本組不出來 —— 沒有 `id` 就沒有
   `/class/$semester/$classId`。
2. **`colleges[].name` 可以是 `null`。** 這一組裝的正是教務處、體育室、通識中心、
   師培中心、校院級課程這 5 個不屬於任何學院的單位。

第 2 點順帶抓出 **Phase 1 的一個既有問題**:搜尋頁的篩選面板直接渲染
`college.name`,那一組因此長出一個**沒有標題的區塊**,使用者只看到五個孤兒按鈕
(`key={null}` 在 React 也是合法的,所以連警告都沒有)。已改成一律走
`collegeGroups()`,`null` 一進來就換成「校級單位」。

### D.19 院級共同課程用資料的形狀判斷,不寫死代碼

§3.4 點名 `C0` `C2` `C5` `C7` 要標註。實測這四個單位**自己的名字**就叫
「機電學院」「管理學院」「電資學院」「創新學院」,而且就掛在同名的學院底下 ——
畫面上和上層的學院標題長得一模一樣,沒有人分得出「這是電資學院的共同課」還是
「電資學院所有系的課」。

判斷條件因此定成「**在某個學院底下,而且自己的名字以『學院』結尾**」。實測全校
60 個單位裡只有這四個符合,與寫死代碼的結果完全一致,但學校加第五個時不必改程式。

### D.20 教師分組要有「其他」這一組

803 位教師按姓名首字分組。實測有 **2 位首字不是中文**:一位是英文名
(`Keerthana K. B.`),另一位的名字裡有 **Big5 造字**(落在 Unicode 私用區,
瀏覽器顯示成豆腐)。讓它們各自佔一個組標題只是噪音,而且私用區字元當標題等於
畫面上多一個看不懂的方框。

一律歸「其他」並排在最後。空字串的姓名也走同一條路,不會生出沒有標題的組。

### D.21 交叉連結一律用代碼,學程例外

課程詳情頁原本把教師連到 `/search?q=<姓名>`(Phase 2 的權宜之計,見 D.16)。
Phase 3 有了教師專頁之後全部改用**代碼**:

| 連結 | 依據              | 為什麼                                           |
| ---- | ----------------- | ------------------------------------------------ |
| 教師 | `teacher_codes`   | 803 個代碼只有 801 個姓名,林志哲與陳盈竹各有兩位 |
| 班級 | `class_ids`       | —                                                |
| 教室 | `classroom_codes` | —                                                |
| 系所 | `department_ids`  | —                                                |
| 學程 | **名稱**          | 學程根本沒有代碼,只有中文名                      |

名稱與代碼是兩個平行陣列。實測 2,717 門課的長度全部對得上,但對不上時**寧可
顯示純文字也不要生出連到別人頁面的連結** —— 錯的連結比沒有連結糟。

學程名裡 86 個有 27 個含括號、破折號、底線或全形【】,但**沒有任何一個含
`/` `?` `#`** —— 那些才會真的把路徑打斷。編解碼交給 router,實測
`工程_第二專長【分子系_有機分子材料】` 往返正常。

### D.22 明細頁不做虛擬捲動

搜尋頁的 2,717 筆需要虛擬捲動,明細頁不需要:最多的是通識中心的 227 門,
差一個數量級。虛擬捲動要一個固定高度的捲動容器,擺在一般的頁面捲動裡反而卡手
(兩層捲動互搶)。明細頁直接渲染整份列表。

### D.23 schema v3(2026-09-05):`syllabus.json` 的型別改了,而且多了三個學期

爬蟲在 Phase 3 上線後約一小時把 `schema_version` 升到 3。逐欄位比對後,
**只有 `meta.json` 與 `syllabus.json` 升版**,各學期的端點仍是 v2。改動有三處:

| 改動                                                       | 沒跟上的後果                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `fetched[學期][課號]` 從時間字串變成 `{ at }` 物件         | 快取版本號變成 `?v=[object Object]`。檔案仍抓得到,但老師改過的大綱**永遠取到舊的那份** |
| 新增 `frozen`(114-2 / 114-1 / 113-2,共 6,035 篇)           | 這三個學期的大綱全部顯示「尚未收錄」——**資料在,站上看不到**                            |
| 單篇大綱移除 `fetched_at`、新增 `content_hash`(僅凍結學期) | 頁尾印出「本站抓取 」後面空白;而且雜湊被當成課程內容渲染成一個區塊                     |

三件事值得記下來:

1. **這是 §1.4 那條「schema 版本不符要警告但不能白畫面」第一次真的派上用場。** 紅色
   警告條確實出現了,而且站仍然可用 —— 只是有兩處資料顯示不正確。
2. **`exactOptionalPropertyTypes` 抓到了第一個錯誤。** 型別一改成
   `SyllabusFetchInfo | string`,TypeScript 立刻指出路由 loader 把整個物件當版本號
   傳下去。這個錯不會丟例外、不會進 console,只會讓快取默默失效 —— 靠人看是看不到的。
3. **D.14「渲染所有未知欄位」吃到第一個假陽性。** `content_hash` 是中繼資料不是內容。
   那個設計的方向仍然對(學校加欄位時要看得見),但需要一份「已知但不顯示」的清單,
   而不是把未知一律當內容。

#### 凍結學期不逐課列出,存在性回頭看 `syllabus_url`

`frozen` 只給整個學期的 `{fetched, with_url, at}`,沒有逐課對照。因為
`fetched === with_url`,「有連結的課全部抓完了」成立,所以個別課程用
`Course.syllabus_url` 判斷就夠準,`at` 則當成整學期共用的快取版本號。

代價是**凍結學期的大綱晚一個來回**:路由 loader 不能光憑「學期凍結了」就預取 ——
那三成沒有大綱連結的課會因此收到 404,正是 §4 Phase 2 驗收條件禁止的事。
`confirmedSyllabusVersion()` 因此只在逐課對照表確認檔案存在時才回傳版本號,
凍結學期的大綱改由元件在拿到課程物件之後才取。

### D.24 介面改版:定出視覺語言、加上導覽、收掉巢狀捲軸

Phase 3 結束後回頭看整個站,問題不是「不夠漂亮」而是**沒有設計語言**:色票是
shadcn 的 neutral(純灰階、零彩度),版面全靠 1px 框線,而且每一頁都是孤島 ——
搜尋頁走不到剛做好的瀏覽頁。

參考 `ntut-course.gnehs.net` 的三個決策,做了同類但不相同的版本:

**1. 一個強調色,只給「可以按」與「目前選中」用。** 原本 `--primary` 在深色模式
是近白色,等於沒有強調色。到處都是重點等於沒有重點,所以它不當裝飾用。

**2. 卡片靠表面亮度分層,不靠框線。** 頁面底色比卡片暗一階(深色模式)或亮一階
(淺色模式),邊界自然浮出來。滿畫面的細框線會讓列表看起來像試算表。

**3. 全站頁首。** 搜尋框放在頁首而不是搜尋頁裡面 —— 它在每一頁都該隨手可用,
而且只有一個搜尋框就不會有「頁首打一個、頁面裡再打一個」的錯亂。
不在搜尋頁時**按 Enter 才導頁**:否則在課程詳情頁不小心打一個字,整頁就被抽掉。

#### 三條捲軸變成一條

原本搜尋頁上同時有三條垂直捲軸:頁面、結果列表(固定高度的虛擬捲動容器)、
篩選面板裡的系所清單。滑鼠滾輪滾到哪一條要看游標在哪裡。

- 結果列表改用 `useWindowVirtualizer` —— 仍然虛擬捲動(2,717 筆不能全渲染),
  但跟著整頁的捲軸
- 篩選面板改成可收合的 `<details>` 分區,系所清單不再需要自己的捲動框。
  已套用條件的分區自動展開 —— 看不到自己套了什麼最糟
- 用原生 `<details>` 而不是自己做 state:鍵盤操作與無障礙是瀏覽器內建的

#### 多欄網格,而且卡片等高

寬螢幕下單欄列表左右都是空的。改用 `lanes` 排成 1 / 2 / 3 欄(隨斷點)。

**卡片高度刻意固定**:課名一律佔兩行高、徽章固定一行。不固定的話多欄會排成
錯落的磚牆 —— 空間是省了,但每一列的起點都對不齊,眼睛得重新找位置,
那正是「看起來很亂」的來源。

`scrollMargin` 改用 `useLayoutEffect` 量測而不是在 render 期讀 ref
(函式庫文件的寫法)。`useLayoutEffect` 在瀏覽器繪製之前跑完,所以沒有看得見的
跳動,而且 lint 規則「不要在 render 期讀 ref」是對的,不該用 disable 繞過。

#### 徽章分三級

原本四個徽章長得一模一樣:「專業選修」「3 學分」「英語」「修課 29 人」看起來
一樣重要。改成必修(強調色底)> 選修類別 / 語言(次要底)> 學分 / 人數(純文字)。
必修用 `required === true` 判斷而不是猜字串 —— 它是三態欄位。

### D.25 sticky 側欄要收在視窗內,否則底部永遠點不到

D.24 把篩選面板改成 sticky 之後漏了一件事:**sticky 只會把元素釘住,不會把它縮進
視窗裡**。展開「學院 / 系所」(60 個系所)後面板有 1,323px 高,視窗只有 793px ——
超出的 530px 被釘在畫面外,底下的「星期 / 節次」與「學分」再也捲不到。

修法是 `max-height: calc(100dvh - 7rem)` 加 `overflow-y: auto`。這確實會多一條
捲軸,但**只在展開長分區時才出現**:分區預設收合,實測預設狀態下內部捲動元素
仍然是 0 個。這與 D.24 要解決的「三條常駐捲軸」是不同的東西。

上限只套在 `md:` 以上 —— 手機版的面板是展開在頁面流裡的,整頁一起捲就好,
不需要也不該有自己的捲軸。

### D.26 明細頁的課程改用與搜尋頁相同的卡片網格

五個明細頁原本是單欄的長列表,和搜尋頁的多欄卡片長得不一樣 —— 同樣是「一堆課
給你挑」,卻有兩套版面。改成同一套:同樣的 `CourseCard`、同樣的 1 / 2 / 3 欄
斷點。`DetailShell` 因此從 `max-w-3xl` 放寬到 `max-w-6xl`,才排得下三欄。

外層那一個卡片容器也拿掉了 —— 課程本身就是一格一格的卡片,再包一層會變成
卡片裡的卡片。

**明細頁仍然不做虛擬捲動**:最多的是通識中心的 227 門,直接用 CSS grid 排就好,
不必為了它再引入一套量測與定位機制(理由同 D.22)。

### D.27 側欄的橫向捲軸來自一個字元的側邊間距

D.25 給側欄加上 `overflow-y: auto` 之後,畫面上多出一條**左右**橫移的捲軸。

原因有兩層:

1. **CSS 規範規定 `overflow-y` 一旦不是 `visible`,`overflow-x` 就跟著算成
   `auto`。** 所以只設 `overflow-y` 等於同時開了橫向捲動。
2. 實測沒有任何子元素比容器寬,溢出只有 **3.33px** —— 來源是分區標題右邊那個
   `›` 字元。文字字符帶著字型的側邊間距,渲染出來的邊界比它的排版寬度大。

改用 SVG 箭頭(邊界是精確的)並補上 `overflow-x: hidden` 當保險。實測收合與
**全部展開**兩種狀態下都不再有橫向捲軸,也沒有任何元素被裁掉。

### D.28 詳情頁的返回改成「上一頁」

課程詳情頁原本寫死「← 回搜尋」。但它可以從搜尋、系所、教師、班級、教室、學程
任何一處進來 —— 對後面那些人來說,那個連結會把他們丟到一個沒去過的地方。

改用 `useCanGoBack()`:站內有上一頁就走 `router.history.back()`。

**但不能只呼叫 `history.back()`。** 分享連結、書籤、新分頁開啟這些情況下站內沒有
歷史,按了要嘛沒反應、要嘛把人踢出這個網站。所以 `BackLink` 收一個 `fallback`,
沒有站內歷史時就顯示原本那個固定連結。實測直接開 `/course/115-1/364893`
確實退回「← 回搜尋」。
