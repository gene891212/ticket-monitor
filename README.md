# Ticket Monitor

LINE Bot 訂閱式票券釋出通知服務。第一期支援 Tixcraft，日後可用相同介面擴充 Ticket Plus 與 Kham。

服務以 Chromium 讀取 Tixcraft 公開的場次選擇頁；不登入、不繞過驗證碼、不加入排隊、不進入選位或自動購票。目前以 Windows 的可見瀏覽器模式執行。

## 訂閱管理

第一期用 LINE 對話指令管理，使用者加好友後直接貼活動網址即可。

- `訂閱 https://tixcraft.com/activity/detail/...`
- `我的訂閱`
- `取消 <訂閱 ID>`
- `說明`

當需要管理大量訂閱、場次／票價篩選或安靜時段時，再增加 LIFF 管理頁；現有資料庫與後端可沿用。

## Tixcraft 判定方式

活動網址會轉至公開場次頁 `/activity/game/<活動ID>`。

- 任一場次含「立即訂購」且未標示「選購一空」：`available`，發送 LINE 通知。
- 所有場次均標示「選購一空」：`unavailable`。
- 尚未開賣、載入失敗或無法判定：`unknown`，不發送通知。

預設每 180 秒檢查一次，程式強制最短 120 秒，避免對售票網站造成壓力。

## Windows 執行

1. 複製 `.env.example` 為 `.env`，填入 LINE token、secret 與資料庫設定。
2. 初次安裝瀏覽器：`npx playwright install chromium`。
3. 執行 `pnpm run build` 後以 `pnpm start` 啟動；開發時可用 `pnpm dev`。
4. 設定 LINE webhook：`https://你的公開 HTTPS 網域/webhook/line`。

每次檢查會短暫開啟 Chromium，完成公開場次表讀取後自動關閉。請保持 Windows 工作階段可用，且不要把 `PLAYWRIGHT_HEADLESS` 設為 `true`。

## 擴充供應商

在 `src/providers/` 新增 `TicketProvider` 實作並加入 `registry.ts`，既有的 LINE 指令、資料庫、通知與排程不用變更。
