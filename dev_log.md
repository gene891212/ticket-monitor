# Ticket Monitor 系統開發日誌 (Development Log)

## 2026-07-14 #1 — 票券監控機器人需求定義與架構方向

**討論主題**：規劃一套可監控票券釋出的機器人，當有票時透過 LINE Bot 通知，並評估訂閱控制方式。

### 需求範圍
- 目標網站先以 Tixcraft 為第一優先
- 後續希望可擴充至：`ticketplus.com.tw`、`kham.com.tw`
- 通知方式採 LINE Bot
- 需要考慮未來可部署於 Linux

### 架構評估
- ✅ 通知通道採 LINE Bot
- ✅ 訂閱管理初期不做 LIFF，先用聊天指令處理
- **評估理由**：開發成本較低，可以先把「監控 + 通知」主流程跑通，後續若訂閱條件、清單管理、介面需求變複雜，再補 LIFF / Web UI。

### 初步技術方向
- 以 Node.js + TypeScript 建立服務。
- provider 架構拆分，方便未來擴充不同售票站。
- 使用資料庫保存訂閱資訊。
- 預留 Docker / Linux 部署能力。

### 使用者決定
- ✅ 先做 Tixcraft
- ✅ 先把核心流程做出來：檢測票況 -> 有票通知 LINE
- ✅ 架構需能支援未來擴充到其他票務平台
- ✅ Linux 部署列入一開始設計考量

### 完成事項
- [x] 定義第一階段產品範圍
- [x] 決定以 LINE Bot 作為通知方式
- [x] 決定初期以聊天指令管理訂閱
- [x] 決定程式架構需保留多平台擴充性

---

## 2026-07-14 #2 — Tixcraft 票況檢測方式驗證

**討論主題**：驗證 Tixcraft 是否能用程式直接抓票況，並確認「有票 / 無票」的判定依據。

### 測試案例
- 理論上有票：`26_edyhsiao`
- 理論上無票：`26_btskns`

### 分析與發現
1. **活動詳情頁不是最終判斷頁**：Tixcraft 的 detail 頁主要是活動介紹，真正能判定票況的是 `/activity/game/<slug>` 頁面。
2. **可用訊號來自 game 頁上的文字**：
   * 若畫面出現 `Find tickets` / `立即購票`，代表有可購買場次。
   * 若出現 `No tickets available`，代表該場次無票。
   * 若出現 `Sale starts at` / `尚未開賣`，代表尚未開賣。
3. **直接 request 會被擋**：以程式直接請求 detail 或 game 頁時，實際回應是 `401`，回傳內容包含 `{"response":"identify"}`，代表站方有機器人識別或防護機制。
4. **單純補 header 仍無法通過**：即使模擬一般瀏覽器常見 header，也仍然被 `401`。
5. **真實瀏覽器自動化也未必能過**：以 Playwright 測試後，實際也遇到 `403`，表示不是單純 request header 問題，而是更完整的防護。

### 決定與結論
- ✅ Tixcraft 的票況判斷邏輯已釐清。
- ❌ 不能假設用單純 request 就能穩定抓到正式站點資料。
- ❌ 目前不能把「內部可讀取頁面內容」誤當成可部署服務的真實能力。
- ✅ 正式產品必須把「站方防護」當成核心限制來設計。

### 完成事項
- [x] 找出 Tixcraft 真正有票況資訊的頁面型態
- [x] 確認「有票 / 無票 / 未開賣」的判定文字
- [x] 驗證直接 request 會回 401
- [x] 驗證補 header 仍無法通過
- [x] 驗證瀏覽器自動化也可能被阻擋

---

## 2026-07-14 #3 — 第一版程式骨架建立與風險收斂

**討論主題**：先建立可擴充的票券監控服務骨架，同時保留對 Tixcraft / TicketPlus / Kham 的擴充空間。

### 已建立的內容
- Node.js + TypeScript 專案骨架
- provider registry 結構
- TixcraftProvider 基本實作
- LINE Bot 通知模組
- 訂閱資料表與資料庫連線
- monitor 流程骨架
- Dockerfile 與 docker-compose.yml
- .env.example
- 基本測試與 build 流程

### 測試結果
- ✅ build 可通過
- ✅ 單元測試可通過
- ⚠️ 測試目前是針對「HTML 判讀邏輯」本身，不代表正式環境一定抓得到 Tixcraft。
- ⚠️ 真實站點請求仍受 401 / 403 防護限制。

### 目前架構上的關鍵判斷
- 這版程式已經把「系統骨架」搭起來。
- 但 Tixcraft 真正的難點不是 parser，而是「如何合法、穩定取得頁面內容」。
- 若站方持續擋自動化流量，後續需要重新選擇資料來源策略，不能只靠既有 request 流程。

### 使用者目前立場
- 希望使用「和目前可讀取結果相同原理」來實作。
- 已明確認知：內部讀取得到，不等於本地部署一定拿得到。
- 服務可行性取決於站方是否允許該來源存取。

### 完成事項
- [x] 建立第一版專案骨架
- [x] 建立 LINE Bot 通知流程基礎
- [x] 建立訂閱資料結構
- [x] 建立 Docker / Linux 部署基礎
- [x] 實作 Tixcraft HTML 判讀邏輯
- [x] 加入測試驗證 parser 行為

### 待確認 / 待處理
- [ ] 決定正式可接受的 Tixcraft 資料取得方式
- [ ] 串接真實 LINE Bot channel 設定
- [ ] 完成聊天指令訂閱管理
- [ ] 規劃 TicketPlus / Kham provider
- [ ] 在 Linux 環境做一次實際部署驗證

---

## 2026-07-14 #4 — Cloudflare MCP 帳號連線確認

**討論主題**：確認目前 Codex / MCP 是否已連上可使用的 Cloudflare 帳號

### 分析與確認
1. 先前檢查本機專案設定時，未發現明確的 `wrangler` 登入資訊、`.wrangler` 狀態或專案內帳號設定
2. 後續重新檢查 Cloudflare MCP 可用工具後，確認目前已有可呼叫的 Cloudflare API MCP
3. 透過 MCP 查詢帳號資訊，確認帳號連線有效

### 確認結果
- ✅ Cloudflare MCP 已有設定好帳號
- 帳號名稱：`Gene891212@gmail.com's Account`
- 帳號類型：`standard`
- Account ID：`f4d745dcd6df9b2a91cce992fe81c08f`

### 補充說明
- 本機 `wrangler login` 狀態與 MCP 已連線帳號是雙邊獨立運作的
- 即使本機 CLI 尚未完成登入，只要 MCP 端已有授權，仍可透過 Cloudflare MCP 操作對應帳號

### 結論
- 目前可視為 Cloudflare MCP 帳號已完成連線，可直接用來查詢或操作 Cloudflare 資源

---

## 2026-07-14 #5 — Cloudflare Worker API 安全驗證機制

**討論主題**：分析 `.env` 中 `WORKER_API_TOKEN` 的用途與安全性。

### 確認的架構
- **Token 驗證機制**：Monitor 與 Cloudflare Worker 之間的 Bearer Token 驗證。

### 發現的問題與分析
1. **API 端點安全性**：Cloudflare Worker 暴露了多個 API，例如讓 Monitor 領取手動檢查的 `/api/manual-checks/claim`，以及回報票況的 `/api/subscriptions/:id/sessions`。
2. **防範惡意請求**：如果沒有權限驗證，任何人都可以隨意對 Worker 發送假報告，修改 D1 資料庫中的場次票況，甚至偽造手動檢查請求。
3. **`WORKER_API_TOKEN` 的角色**：它作為 Monitor 在呼叫 Worker 時的 Authorization Bearer 密鑰。Worker 在接收到請求時，會比對 Header 中的 Token 是否與環境變數中的 `WORKER_API_TOKEN` 一致，以此確保只有受信任的 Monitor 才能讀寫後台資料庫。

### 決定與行動
- ✅ **落實 Bearer Token 防護**：確保 Monitor 的 `.env` 與 Cloudflare Worker 的 Wrangler 環境變數中皆配置相同的 `WORKER_API_TOKEN` 以啟用安全阻擋。

---

## 2026-07-14 #6 — 拓元 WAF 繞過與 Cookie 複用機制設計

**討論主題**：由於每次檢查都開啟 Playwright 瀏覽器開銷過大，如何實現低資源消耗的「Cookie 複用（Cookie Reuse）」方案。

### 確認的架構
- **混雙架構 (Hybrid Architecture)**：Playwright (Stealth Headless) + Node.js 原生 `fetch` (Cheerio)
- **流程**：`定時啟動 Playwright 無頭瀏覽器 → 繞過 Cloudflare WAF → 提取驗證 Cookies → 關閉瀏覽器 → 將 Cookies 複用給極輕量的 HTTP fetch → 快速輪詢售票頁`

### 發現的問題與分析
1. **直接 Fetch 遭阻擋**：使用 Node.js 原生 `fetch` 直接抓取拓元會收到 `401 Unauthorized` 並被導向驗證頁面，Response Header 包含 `tm-bl: 1` 標記。原因在於拓元使用了基於 JS 的 WAF，普通 HTTP 請求無法執行 JS 驗證。
2. **Cookie 壽命有限**：經測試 `tmpt` 安全驗證 Cookie 的壽命只有 **1 小時**，而 `TIXUISID` 與 `_csrf` 是隨瀏覽器關閉的 Session Cookie。因此必須定時（如每 50 分鐘）重整快取 Cookie，否則後續輪詢會被重新判定為 401/403。

### 決定與行動
- ✅ **實作主動與被動 Cookie 快取**：
  * **主動**：每 50 分鐘主動以 Playwright 背景更新 Cookie。
  * **被動**：當輪詢時遇到 `401/403` 阻擋，自動觸發 Playwright 自癒更新 Cookie。
- ✅ **建立診斷測試腳本**：
  * `test-cookie-reuse.ts` (Cookie 複用抓取測試)
  * `print-cookie-expiry.ts` (Cookie 屬性與過期時間列印)

---

## 2026-07-14 #7 — 系統資料流整合與 Mermaid 架構圖導入

**討論主題**：梳理整個專案（LINE Bot、Cloudflare Worker D1、本地 Monitor）的完整資料流，並寫入專案文件。

### 確認的架構
- LINE 使用者 ⇆ Cloudflare Worker (D1 SQLite) ⇆ 本地 Monitor (Playwright / Fetch)。
- 使用 Mermaid 圖表呈現在 README 文件中。

### 發現的問題與分析
1. **架構複雜性**：因為專案跨足了雲端 Worker 與本地 Monitor，且有手動與自動兩種輪詢機制，需要一個清晰的流程圖供開發者快速理解。
2. **Mermaid 整合**：為了自動化產生與驗證 Mermaid 圖表，建立了 `find_mermaid.js` 與 `extract_full_mermaid.js` 輔助工具。

### 決定與行動
- ✅ **更新 README.md**：導入了完整的架構與流程圖說明（Mermaid Flowchart），詳細說明了 Monitor 檢查與自癒更新的資料流向。

---

## 2026-07-14 #8 — 減少重複通知過濾、Git 重整與工作區清理

**討論主題**：避免 LINE 機器人重複發送相同的有票通知以節省額度，並重整已經分歧的 Git 本地分支。

### 確認的架構
- 本地 Monitor 快取 + 雲端 Worker 雙重防重推播。
- 專案檔案結構簡化，診斷腳本統一存放至 `scratch/`。

### 發現的問題與分析
1. **LINE 推播額度損耗**：若不進行過濾，每次輪詢一旦偵測到有票，就會對 Worker 發起回報並觸發 LINE Push API。LINE Bot 免費額度極少，會迅速耗光。
2. **本地分支分歧 (Divergence)**：
   * `feat/write-on-change` 分支擁有「重複通知過濾」，但缺乏 `main` 分支的「Cookie 快取」。
   * 本地 `main` 分支擁有「Cookie 快取」，但缺乏「重複通知過濾」。
   * `headless-test` 分支已完全合併，但在另一個資料夾 `D:/code/ticket-monitor-headless` 以 `git worktree` 的形式維持檢出，導致分支結構雜亂且代碼落後。

### 決定與行動
- ✅ **實作本地記憶體快取 `sessionCache`**：在 Monitor 本地端比對票況。只有在場次售票狀態有變更（如售完變有票，或有票變售完）時，才向 Worker 發送報告。
- ✅ **優化 LINE Bot 「我的訂閱」**：使用 `LEFT JOIN` 同步查詢場次詳細資訊，回覆時免費附帶各場次最新狀態圖示（🟢 有票 / ❌ 售完 / ❓ 未知）。
- ✅ **防斷線/重開防禦**：
  * 當本地 Monitor 重啟快取遺失時，Worker D1 依然會透過 `last_notified_status` 攔截，確保使用者不收到重複通知。
  * 手動檢查 (`立即檢查`) 提供 2 分鐘超時自動釋放機制，若 Monitor 斷線重開，任務會自動被重新領取並執行。
- ✅ **Git 分支重整**：
  * 將 `feat/write-on-change` 重定基底（Rebase）到本地 `main`，整合兩者功能。
  * 將所有變更 Commit 後，Fast-forward 合併回本地 `main` 分支，使 `main` 成為具備所有最新功能的唯一分支。
- ✅ **清理冗餘工作區**：
  * 強制移除並刪除 `D:/code/ticket-monitor-headless` 工作區目錄，並刪除本地 `headless-test` 分支。
- ✅ **整合診斷工具**：
  * 將舊有診斷腳本重構並統一存放至 `scratch/` 目錄（包含 `test-tixcraft-all.ts` 拓元 5 模式繞過測試、`print-cookie-expiry.ts`、`test-cookie-reuse.ts`）。
  * 調整 `.gitignore`，設定**只忽略圖片與截圖檔**，確保三款 TypeScript 診斷腳本能被 Git 追蹤並同步至 GitHub。
- ✅ 記錄設計決策：建立專案規則檔 `.agents/AGENTS.md`，寫入「主動心跳回報 + 免費指令查詢」的系統狀態監控設計協定。

---

## 2026-07-15 #9 — Cloudflare API MCP Server 與 Skills 安裝

**討論主題**：將 Cloudflare 官方 MCP 伺服器與 Cloudflare Skills 插件安裝到 Antigravity 助理中。

### 實作內容
- **MCP 連線配置**：在 `C:\Users\gene\.gemini\antigravity\mcp_config.json` 中配置了 Cloudflare API MCP 遠端連線，並搭配 API Token 進行 Bearer 認證。
- **全域 Skills 匯入**：自 `cloudflare/skills` 官方倉庫將 `wrangler`、`agents-sdk`、`durable-objects` 等 11 個 Cloudflare 專用 Agent 技能複製至全域 `C:\Users\gene\.gemini\config\skills/` 目錄，使 Antigravity 開發環境具備 Cloudflare 專長。
- **連線驗證**：在本地環境使用該 Token 成功呼叫 `npx wrangler whoami` 取得 `gene891212@gmail.com` 帳號授權，驗證 Token 的 Workers 與 D1 讀寫權限皆正常運作。

---

## 2026-07-15 #10 — 免費手動檢查（立即檢查）機制部署與驗證

**討論主題**：正式更新 D1 資料庫結構並部署 Worker，啟用為「立即檢查」設計的非同步 `replyToken` 節能方案。

### 實作內容
- **D1 結構更新**：執行資料庫變更 `ALTER TABLE manual_check_requests ADD COLUMN reply_token TEXT;`，以在 D1 中持久化儲存 LINE Webhook 傳入的 `replyToken`。
- **Worker 部署**：完成 `cloudflare-worker` 的打包並成功部署至 Cloudflare 雲端平台。
- **非同步 Reply 邏輯**：當收到 `立即檢查` 時，Worker 將 Token 存入資料庫且安靜不語。等本機 Monitor 爬蟲於 15 秒後回報資料時，Worker 再將 D1 中的 Token 撈出來以免費的 Reply API 發送完成通知。若超時（>40秒）則自動降級使用 Push API 回覆，完美兼顧節能與高送達率。

---

## 2026-07-15 #11 — Monitor 容錯提升與網址規格對齊

**討論主題**：修復本地 Monitor 遭遇雲端暫時性 500 錯誤時會崩潰退出的 Bug，並優化 README 的訂閱範例網址。

### 實作內容
- **Monitor 容錯修復**：修復了 [monitor.ts](file:///d:/code/ticket-monitor/src/monitor.ts) 中的 `poll()` 方法在發生網路/Cloudflare D1 暫時性連線失敗時，因為 unhandled rejection 直接崩潰進程的 Bug。已在主排程補上 `catch` 區塊，當發生錯誤時僅作 log 輸出，不影響下一次輪詢排程。
- **網址規範更新**：配合程式實作，將 [README.md](file:///d:/code/ticket-monitor/README.md) 中訂閱指令的 URL 範例修正為官方場次頁 `/activity/game/...`。
- **匹配規則確認**：程式 [tixcraft.ts](file:///d:/code/ticket-monitor/src/providers/tixcraft.ts) 嚴格匹配 `/activity/detail/` 與 `/activity/game/` 兩種合法路徑，其餘非標準路徑不進行處理，以防產生非預期的異常。

---

## 2026-07-15 #12 — 訂閱網址全面規範與歷史資料清洗 (Game URL only)

**討論主題**：確保 LINE Bot 訊息、我的訂閱清單以及背景通知中發送的購票網址，一律採用直接買票的 `game` 網址格式。

### 實作內容
- **訂閱端自動標準化**：修改了 [index.js](file:///d:/code/ticket-monitor/cloudflare-worker/src/index.js) 中的 `訂閱` 命令邏輯。當使用者輸入 `detail` 或 `game` 網址時，Worker 在存入 D1 前會自動將其標準化轉換為 `/activity/game/...` 格式。
- **資料庫舊資料清洗**：執行了 SQL 更新指令，將 D1 資料庫中所有已訂閱的歷史紀錄（共 3 筆）的 `event_url` 中的 `/activity/detail/` 全部替換為 `/activity/game/`。
- **重新部署 Worker**：成功部署新版的 Worker，確保所有對外推送通知的「前往購票」連結都指向高效的 `game` 頁面。

---

## 2026-07-18 #13 — 拓元 WAF 防禦重構與持久化瀏覽器上下文、Poll 隨機化抖動

**討論主題**：解決本機開啟 `pnpm dev` 時，因 Node 原生 `fetch` 被 AWS WAF 指紋封鎖而頻繁彈出/關閉多個 Playwright 瀏覽器視窗的問題。

### 實作內容
- **完全停用原生 `fetch` 抓取**：Node.js 原生 `fetch` 的 TLS 握手特徵（JA3/JA4）易被拓元 AWS WAF 直接標記為 Bot。為防 IP 被集體拉黑，全面移除 `fetchWithCookies` 與手動 Cookie 快取更新邏輯。
- **持久化常駐瀏覽器與分頁 (Persistent Browser & Single Tab)**：
  - 重構 [tixcraft.ts](file:///d:/code/ticket-monitor/src/providers/tixcraft.ts) 改為常駐的單一 Playwright 瀏覽器與單一固定分頁 (`this.mainPage`)。
  - 當需要檢查多個訂閱時，直接在原分頁利用 `goto` 進行原地跳轉，完全避免以前因為「關閉最後一個分頁 (Tab) 會導致瀏覽器視窗自動關閉」而造成的視窗反覆開關閃爍。
  - 當瀏覽器或分頁被使用者不小心關閉時，藉由 `isConnected()` 及 `isClosed()` 自動檢測並自癒重新開啟。
- **首頁預熱機制 (Context Warmup)**：
  - WAF 對於直接進入購票深層頁面（`/activity/game/*`）的請求會有嚴格的 referrer 驗證。
  - 在瀏覽器上下文啟動時，先開啟分頁模擬人類訪問拓元首頁並等待 3 秒再關閉，替該 Context 建立合法的基礎 WAF 會話。
- **診斷工具精度升級**：
  - 更新了 [test-tixcraft-all.ts](file:///d:/code/ticket-monitor/scratch/test-tixcraft-all.ts)，加入對 AWS WAF 401 阻擋標題與空白頁面內容的檢測。
  - 建立 [test-persistent-browser.ts](file:///d:/code/ticket-monitor/scratch/test-persistent-browser.ts) 驗證持久化分頁防禦成效。
- **輪詢隨機抖動 (Randomized Jitter)**：
  - 將 [index.ts](file:///d:/code/ticket-monitor/src/index.ts) 中的固定 `setInterval` 定時器改為遞迴 `setTimeout` 輪詢。
  - 每次輪詢後加入 `+/- 15%` 的隨機時間抖動（以 15 秒為例，變動於 12.75 到 17.25 秒之間），打亂特徵，躲避 WAF 的規律頻率偵測。
- **整合測試對齊**：
  - 重構 [tixcraft.integration.test.ts](file:///d:/code/ticket-monitor/src/providers/tixcraft.integration.test.ts) 中的 Check #1 與 Check #2 以配合「常駐瀏覽器」性能對比（驗證第二次頁面讀取因無啟動進程開銷而大幅加快）。

---

## 2026-07-18 #14 — TicketPlus 售票系統整合與本地 AES 解密實作

**討論主題**：新增對 TicketPlus (遠大售票) 系統的監控支援，並透過逆向解密與直接 API 請求實現極致輕量的輪詢。

### 需求範圍與實作機制
- **網址相容**：網域名稱匹配 `ticketplus.com.tw`，路徑格式嚴格匹配 `/activity/<UUID>`（相容結尾斜線）。
- **本地 AES-128-CBC 解密**：
  - 經分析前端 JS 資源包，解鎖了 TicketPlus 的 ID 轉換邏輯。公開 UUID 實為內部順序 ID (eventId) 與場次 UUID (sessionId) 加密後的 Hex 字串。
  - 金鑰 (Key) 為 `ILOVEFETIXFETIX!`，IV 為 `!@#$FETIXEVENTiv`，演算法為 `aes-128-cbc`。
  - 本地端直接解密，無須額外的請求或瀏覽器動作即可獲得內部 ID，極其省時（解密過程 < 1ms）。
- **輕量化 API 直接輪詢**：
  - 抓取場次資訊：`https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/${eventUuid}/sessions.json`
  - 批次取得票況：`https://apis.ticketplus.com.tw/config/api/v1/get?eventId=${eventId}&sessionId=${sessionIds}`
  - 比起 Tixcraft 的 Playwright 方案，TicketPlus 僅需兩次並行 fetch 與一個 status GET 請求，單次檢查僅耗時 100~300ms，對 Monitor 的資源開銷幾近於零。

### 逆向工程與 API 破解分析歷程
由於 TicketPlus 前端與 API 之間存在 ID 混淆機制，以下為分析並重構該邏輯的解密歷程：
1. **網路請求嗅探 (Network Sniffing)**：
   - 藉由 Playwright 截獲網頁請求，發現在網頁載入後，會向 `https://apis.ticketplus.com.tw/config/api/v1/get?eventId=e000001412&sessionId=s000002092` 發送票況請求。
   - 然而，`e000001412`（活動 ID）與 `s000002092`（場次 ID）在 `event.json` 及 `sessions.json` 中皆不存在（僅有公開的 UUID `4b47b536...` 與 `8bd271d3...`）。此特徵代表前端 JS 具備本地 ID 轉換機制。
2. **定位加密模組**：
   - 在下載的前端 `app.js` 靜態資源中，搜尋 `/api/v1/get` 與 `eventId` 關鍵字，定位到轉換函式 `Object(a["a"])(e)`。
   - 進一步追查變數 `a`（Webpack 模組代碼 `9263`），發現其使用內置的金鑰與 `crypto` 模組進行加解密：
     - **演算法**：`aes-128-cbc`
     - **金鑰 (Key)**：`ILOVEFETIXFETIX!`
     - **初始向量 (IV)**：`!@#$FETIXEVENTiv`
     - 解密方法為傳入十六進位 (Hex) 格式的 UUID，解密後調用 `toString()` 還原出明文順序 ID。
3. **本地移植驗證**：
   - 經使用 Node.js 原生 `crypto` 模組與此 Key/IV 對 `4b47b536...` 進行解密，成功產出 `e000001412`。
   - 至此完整還原出整個 API 邏輯，讓我們得以擺脫 headless 瀏覽器，改以純 HTTP Fetch 秒級輪詢。

### Cloudflare Worker 端與專案變更
- **Worker 訂閱相容**：修改 [index.js](file:///d:/code/ticket-monitor/cloudflare-worker/src/index.js)，新增 `isTicketplus(url)` 驗證與網址正規化邏輯，更新 `訂閱` 命令處理器以動態將正確的 `provider`（`'ticketplus'`）寫入 SQLite D1 資料庫中。
- **部署指令整合**：在 [package.json](file:///d:/code/ticket-monitor/package.json) 中加入 `"worker:deploy": "npx wrangler deploy --config cloudflare-worker/wrangler.jsonc"`，便於從根目錄使用通用性最高的 `npx` 部署或更新 Worker。

### 驗證結果
- **單元測試**：在 [ticketplus.test.ts](file:///d:/code/ticket-monitor/src/providers/ticketplus.test.ts) 中加入 supports、decryption 及 check 模擬測試，100% 通過。
- **實地輪詢測試**：
  - 音田雅則 / Ave Mujica / EMI NODA 演唱會：回傳 `available` (🟢)。
  - back number / TREASURE / YUURI 演唱會：回傳 `unavailable` (已截止/售完/pending，❌)。
- 所有測試與 live 偵測均完美運作，且順利整合入 monitor 核心。

