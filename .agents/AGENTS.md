# Project Rules & Design Decisions

## 系統健康狀態查詢設計協議 (Health Check Design Agreement)

為了在「監控系統狀態」與「節省 LINE Bot 每月免費推播額度 (Push Message)」之間取得平衡，專案協議採用 **主動心跳回報 + 免費指令查詢** 的設計。

### 1. 核心原則
* **不使用 Push API 報錯**：避免在自動輪詢出錯（如網站改版、IP 被鎖）時自動發送 LINE 推播，以免瞬間耗光 LINE 的免費推播額度。
* **利用免費的 Reply API**：使用者的狀態查詢請求（例如輸入 `狀態` 或 `系統狀態`）必須一律透過 `replyToken` 進行回覆（LINE 官方規定 Reply 訊息完全免費且不限次數）。

### 2. 實作架構規劃

#### A. 資料庫設計 (D1 SQLite)
新增一個輕量級的系統狀態表，例如 `system_status`：
```sql
CREATE TABLE IF NOT EXISTS system_status (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### B. 監控主機端 (Monitor - Heartbeat)
* 本地 Monitor 每次執行 `poll()` 或 `pollManual()`（不論成功或失敗），都需更新資料庫中的心跳紀錄：
  * `last_heartbeat`: 當前時間戳記。
  * `last_status`: 執行狀態 (`success` / `error`)。
  * `last_error`: 若失敗，紀錄錯誤訊息縮寫；若成功則清除。

#### C. 雲端 Worker 端 (LINE Bot - Reply)
* 新增 LINE 機器人指令處理：`狀態` 或 `系統狀態`。
* 接收到指令後，查詢 `system_status` 表：
  * 計算心跳延遲時間（`當前時間 - last_heartbeat`）。若大於 10 分鐘，判定監控主機已斷線。
  * 拼裝狀態文字，使用 `reply` 管道回覆給使用者：
    ```text
    🤖 系統健康報告
    • 監控主機：🟢 正常 / 🔴 斷線 (最後心跳：X 分鐘前)
    • 爬蟲狀態：🟢 正常 / ⚠️ 異常
    • 錯誤資訊：[最後錯誤訊息 (如有)]
    ```
