# ntut-course-web

臺北科技大學課程查詢網站。資料來自
[`ntut-course-crawler`](https://github.com/tntrock/ntut-course-crawler)
的靜態 JSON API,前端純靜態、無後端。

**非官方網站**,一切以學校公告與課程系統當下顯示的內容為準。

完整的開發規格與決策存檔在 [`plan.md`](./plan.md)。

## 目前進度

Phase 0(專案骨架與資料層)完成。搜尋與其餘頁面建置中。

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

### 相容性

crawler 承諾:新增欄位不升 `schema_version`,移除欄位 / 改型別 / 改語意才升版。
所以型別只宣告用得到的欄位,也不做 runtime schema 驗證。版本不符時顯示警告橫幅
但仍照常渲染 —— 不會白畫面。

## 技術棧

Vite 8、React 19、TypeScript(嚴格模式)、TanStack Router / Query、
Tailwind CSS v4、shadcn/ui(Base UI)、Vitest。部署在 Cloudflare Pages。

## 授權

MIT
