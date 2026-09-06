# ntut-course-web

臺北科技大學課程查詢網站。資料來自
[`ntut-course-crawler`](https://github.com/tntrock/ntut-course-crawler)
的靜態 JSON API,前端純靜態、無後端。

**非官方網站**,一切以學校公告與課程系統當下顯示的內容為準。

完整的開發規格與決策存檔在 [`plan.md`](./plan.md)。

## 功能

| 頁面        | 內容                                                           |
| ----------- | -------------------------------------------------------------- |
| `/search`   | 關鍵字 + 系所 / 必選修 / 語言 / 時段 / 學分篩選,條件全在網址上 |
| `/browse`   | 系所、教師、學程、教室四個分頁,以及各自的明細頁                |
| `/course/…` | 課程詳情與教學大綱                                             |
| `/schedule` | 我的課表:格線、衝堂偵測、學分統計、異動標示、PNG 匯出          |
| `/changes`  | 最近異動時間軸                                                 |
| `/about`    | 資料來源、已知限制、開放 API 說明                              |

離線可用(PWA),深色模式,個人資料只存在瀏覽器並可匯出 / 匯入。

## 開發

```bash
npm install
npm run dev          # http://localhost:5173
```

| 指令                 | 用途                                                            |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | 開發伺服器                                                      |
| `npm run build`      | 產生 `dist/`(先跑 `tsr generate`,再 `tsc -b`,最後 `vite build`) |
| `npm run preview`    | 預覽 build 結果                                                 |
| `npm test`           | 跑一次測試                                                      |
| `npm run test:watch` | 監看模式                                                        |
| `npm run lint`       | oxlint                                                          |
| `npm run format`     | Prettier                                                        |
| `npm run deploy`     | build 後部署到 Cloudflare(需先 `wrangler login`)                |

### 環境變數

複製 `.env.example` 成 `.env`:

```
VITE_API_BASE=https://tntrock.github.io/ntut-course-crawler
```

不寫死在程式碼裡,未來換 CDN 或加代理層只要改這一行。

### 為什麼 `src/routeTree.gen.ts` 要進版控

`build` 的順序是 `tsc -b` 先於 `vite build`,而這個檔案平常是由 Vite plugin
產生的 —— CI 上如果沒有它,型別檢查會直接失敗。所以它既進版控,`build`
也會先跑一次 `tsr generate` 確保它是最新的。

## 架構重點

### 版本化快取(`src/lib/api.ts`)

資料來源是 GitHub Pages,`Cache-Control: max-age=600` 改不掉 —— 對「舊學期資料
永遠不會變」來說太短。做法是把該學期的 `generated_at` 當版本號放進 query string:

```
GET {BASE}/115-1/index.json?v=2026-09-05T03:34:59Z
```

GitHub Pages 忽略未知的 query string 照樣回檔案,但瀏覽器與 Cache Storage 會把它
當成不同的 URL。於是版本沒變就命中快取(零網路請求),版本一變就自動抓新的。
同路徑的舊版本會被清掉,快取不會無限成長。

`meta.json` 是例外 —— 它是所有其他端點的版本來源,永遠走網路優先,
抓不到時退回快取並在畫面上標示為離線資料。

Cache Storage 不可用(無痕視窗、舊瀏覽器)時自動降級為純網路,功能不受影響。

### 個人資料的儲存(`src/lib/storage.ts`)

課表與收藏存在 `localStorage`,存的是**課號加一份快照**而不只是課號。這讓兩件事
成為可能:離線時直接用快照畫課表,連上線後把快照跟最新資料比對,課被停開、調課、
換老師、改學分都能標出來。

兩條硬規則:`loadStore()` **永遠不丟例外、永遠回傳可用的結構**(個人資料出問題不該
讓整個網站白畫面);**絕不靜默丟掉資料** —— 整包救不回來時先原樣備份再重置,
並在畫面上告訴使用者、提供下載。

### 兩層快取互不干涉

Service worker(Workbox)**只管 app shell**,API 資料完全不碰 —— 那一份由上面
那層版本化的 Cache Storage 管。兩套快取管同一份資料只會互相打架,而且只有版本化
那層知道 `generated_at`。

Service worker 用 `registerType: 'prompt'` 而不是 `autoUpdate`:自動更新會在背景
換掉程式碼並重新載入頁面,而使用者可能正排課排到一半。

### 相容性

crawler 承諾:新增欄位不升 `schema_version`,移除欄位 / 改型別 / 改語意才升版。
所以型別只宣告用得到的欄位,也不做 runtime schema 驗證。版本不符時顯示警告橫幅
但仍照常渲染 —— 不會白畫面。

## 技術棧

Vite 8、React 19、TypeScript(嚴格模式,含 `exactOptionalPropertyTypes` 與
`noUncheckedIndexedAccess`)、TanStack Router / Query、Tailwind CSS v4、
Vitest + Testing Library、`vite-plugin-pwa`。部署在 Cloudflare Workers(Static Assets)。

測試 285 個,涵蓋搜尋評分與正規化、篩選邊界、時段格式化、快取版本、儲存層的
損毀復原、課表衝堂與統計、異動事件的分組與代碼翻譯。

## 授權

MIT
