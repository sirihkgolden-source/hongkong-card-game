# 霓虹牌局（hk-roguelite）

> 工作名：《霓虹牌局》／《街頭牌路》  
> 狀態：新專案骨架（可開標題／選角占位）  
> **這是全新遊戲，不是《香江 Card Game》續作。**

## 產品定位

香港霓虹街頭卡牌 Rogue-lite：揀角色、組牌闖三區，一鋪一個傳奇——短、上癮、想再來一局。

- 世界：香港（街頭／城寨／夜市／天台）
- 結構：選角 → 節點地圖 → 戰鬥／事件等 → 打完必改局 → 3 Act Boss
- 本目錄只做新入口與骨架；戰鬥垂直切片屬下一任務

## 如何本地打開

在本目錄開靜態伺服器（推薦）：

```bash
cd hk-roguelite
python3 -m http.server 8766
```

瀏覽器開啟：<http://127.0.0.1:8766/>

亦可直接用瀏覽器打開 `hk-roguelite/index.html`（`file://` 可用；目前無必須 fetch 的資源）。

**入口檔**：`hk-roguelite/index.html`

## 目錄結構

```
hk-roguelite/
├── index.html      ← 新專案入口
├── css/main.css
├── js/main.js      ← 標題／選角占位
├── assets/         ← 新專案素材（需要時從舊作複製進來再改）
└── README.md
```

## 與舊《香江 Card Game》demo 的隔離

| 規則 | 做法 |
|------|------|
| 新專案路徑 | 本倉庫子目錄 `hk-roguelite/` |
| 新入口 | `hk-roguelite/index.html`（獨立於根目錄 `index.html`） |
| 禁止 | **不修改**倉庫根目錄舊 demo 的主循環／`index.html`／既有遊戲邏輯當本體迭代 |
| 舊作素材 | 根目錄 `assets/`、`data.js` 等僅**唯讀參考**；若需使用，**複製**進 `hk-roguelite/` 再改 |

本骨架 **未改動** 根目錄 `index.html`、`app.js`、`styles.css`、`data.js`。

## 目前畫面

1. **標題**：品牌《霓虹牌局》＋一句定位  
2. **選角占位**：三個占位角色（阿美／阿啟／阿欣）  
3. **開始（占位）**：提示下一任務接地圖 → 戰鬥 → 選牌 → Boss  

尚未實作戰鬥、地圖或選牌邏輯。

## 下一步垂直切片範圍

在 **本目錄**（`hk-roguelite/`）內完成：

**一角色、一 Act**：地圖 → 戰鬥 → 選牌 → Boss

不在根目錄舊 demo 上疊加。
