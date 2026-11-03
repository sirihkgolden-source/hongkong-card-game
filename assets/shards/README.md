# assets/shards — 戰鬥卡殘頁

## 現況（t392）

| 檔案 | 用途 |
|---|---|
| `shard-item.jpg` | **殘頁道具圖**（765×1024，仿古殘破紙 + 「殘頁」書法）。用在：卡冊橫幅圖示、兌換面板「殘頁 → 卡」對照、賭檔結果「殘頁 ×N」 |

殘頁可換的專屬卡：**C254「籠鬥之王」**（卡圖 `assets/fighters/C254.jpg`）

## 接入方式（已實作）

`app.js`：
- `SHARD_ITEM_ART = "assets/shards/shard-item.jpg"` — 統一常數
- `shardIconHtml(extraCls)` — 產生圖示 `<img>`，三個位置共用

`styles.css`：
- `.shard-item-ico` — 橫幅／結果頁小圖示
- `.shard-pair` / `.shard-arrow-mid` — 兌換面板「殘頁 → 卡」
- `.shard-gain` — 結果頁「殘頁 ×N」

## 若要換圖

直接覆蓋 `shard-item.jpg` 即可，全部位置會自動更新。
建議保持 3:4 直圖（現時 765×1024）。
