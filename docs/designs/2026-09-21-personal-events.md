# 課表加入個人事務（issue #21）

> 狀態：**設計，未實作。** 等確認後才動手。

讓使用者把打工、社團、通勤、實驗室之類的固定時段放進課表，排課時才看得到
真正的衝突。

---

## 讀完現有程式碼之後的三個發現

這三件事直接決定了做法，先講。

### 一、`STORE_VERSION` **不能**升

`loadStore()` 有這一段（`src/lib/storage.ts:209`）：

```ts
if (version > STORE_VERSION) return backupAndReset(raw)
```

Service worker 用的是 `registerType: 'prompt'`，使用者可以一直不更新。所以
「新分頁寫了 v2 → 使用者在另一個還沒更新的分頁打開 → 舊程式看到 v2 →
**備份並重置**」是會真的發生的。雖然有備份不算違反第二條硬規則，但課表在
使用者眼前變空，體驗上就是壞掉。

**結論：版本號不動。**

### 二、舊版程式會**吃掉**它不認得的欄位

`loadStore()` 是**重建**而不是合併：

```ts
return {
  version: STORE_VERSION,
  schedules: toSchedules(parsed.schedules),
  favorites: toFavorites(parsed.favorites),
  settings: toSettings(parsed.settings),
}
```

不在這四個 key 裡的東西，讀進來就沒了，下次存檔即永久消失。所以個人事務
**不能**放在 `Store` 裡面（不論是頂層還是塞進 `schedules[sem]`，`toSchedules`
一樣是重建）。

**結論：另開一個 localStorage key**，`ntut-course-web:v1.events`。舊版程式
從頭到尾不會碰到它——看不到，但也毀不掉。這是唯一能同時滿足「不升版本」和
「舊分頁不會弄丟資料」的做法。

### 三、下游全部吃 `SavedCourse`

`buildGrid`、`layoutRuns`、`conflictingCourseIds`、`scheduleStats`、
`diffSnapshot` 五個函式的型別全部是 `SavedCourse`。個人事務要進格子，就得
處理這個接縫。

---

## 資料形狀

```ts
/** 個人事務。刻意用 `time_slots` 這個名字 —— 跟課程同形狀才能共用排版。 */
export interface PersonalEvent {
  id: string // 'evt_' + crypto.randomUUID()
  title: string // 1–20 字，必填
  time_slots: TimeSlot[] // 跟 CourseSnapshot 同一個型別
  note: string | null
  createdAt: string
}

/** 各學期獨立，跟 schedules 一致。 */
type EventStore = Record<SemesterPath, PersonalEvent[]>
```

存在 `ntut-course-web:v1.events`，載入走跟 `loadStore()` 一樣的兩條硬規則：
**永不丟例外、壞掉先備份再重置**。

## 型別接縫：`GridItem`

不要把個人事務偽裝成 `SavedCourse`（塞一個假課號、`credits: null`）。那樣
`buildGrid` 確實免改，但**學分統計哪天多一個欄位就會把事務算進去**，而且
不會有人發現——跟這個專案一路在防的失敗模式是同一種。

改成一個窄的聯集：

```ts
export type GridItem =
  | { kind: 'course'; id: string; course: SavedCourse }
  | { kind: 'event'; id: string; event: PersonalEvent }
```

`Grid.cells` 與 `CourseRun` 改吃 `GridItem`。換來的是：

- **衝堂偵測、分欄排版完全共用**，不必寫第二套
- `scheduleStats()` 和 `diffSnapshot()` 的簽名**維持 `SavedCourse[]`**，
  型別上就不可能拿到事務。學分統計與異動比對**不需要任何 if**

## 五個接點

| 接點                       | 做什麼                                   |
| -------------------------- | ---------------------------------------- |
| `buildGrid` / `layoutRuns` | 改吃 `GridItem`，邏輯不變                |
| `scheduleStats`            | **不改**。呼叫端只傳課程                 |
| `diffSnapshot`             | **不改**。事務沒有上游，不參與比對       |
| 匯出 / 匯入 JSON           | 加一個 `events` 欄位，`version` 維持 `1` |
| PNG 匯出                   | 事務也要畫進去，樣式與課程區隔           |

匯出檔的 `version` 為什麼不升：`parseImport()` 看到比自己新的版本會整個拒收
（`reason: 'unsupported'`）。升版等於讓舊分頁**連課程都匯入不了**；維持 1 的
話舊分頁只是忽略事務，課程照常進去。

## 介面

課表頁底下加「加入個人事務」。表單四欄：名稱、星期、節次（起—迄）、備註。
節次下拉一律讀 `meta.periods` 的陣列順序（`1 2 3 4 N 5 6 7 8 9 A B C D`），
不能自己排。

格子裡的事務用**不同的底色與虛線邊框**跟課程區分，不放課號那一列。
衝堂一樣標紅——事務跟課程撞，正是這個功能要解決的事。

## 不做的事

- **重複週期**（隔週、單雙週）—— 課表本身是週循環，先不引入例外
- **跨學期複製** —— 等有人真的開口再說
- **提醒 / 通知** —— 沒有後端，做不到也不該假裝做得到
- **自訂顏色** —— 全站沒有任何使用者自訂顏色的地方，不為這個開先例

## 測試計畫

先寫會紅的，逐條做：

1. 事務與課程撞在同一格時，兩邊都被標成衝堂
2. `scheduleStats` 拿不到事務（型別層面 + 執行期驗證總學分不變）
3. 異動比對不會把事務標成「已停開」
4. 舊的匯入檔（沒有 `events`）照常匯入，事務為空陣列
5. 帶 `events` 的匯入檔能還原
6. `events` 的 localStorage 壞掉時，課表照常顯示（第一條硬規則）
7. 壞掉的 `events` 會先備份再重置（第二條硬規則）

## 要你決定的

1. **事務要不要跨學期共用？** 我的建議是**跟課程一樣各學期獨立**——
   打工時間每學期都會變，而且跨學期共用會讓「這學期有幾個事務」變得難解釋。
   之後真的需要再加一個「複製到其他學期」的按鈕。
2. **節次以外要不要支援任意時間（例如 18:00–19:30）？** 建議**不要**。
   課表是節次格線，任意時間會逼出一套新的排版規則，而衝堂比對的意義也會變模糊。
