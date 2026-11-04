# 香江小風波（hk-roguelite）

> **正式產品名：《香江小風波》**  
> 目錄暫名：`hk-roguelite/`（對外顯示名必須用《香江小風波》）  
> 狀態：垂直切片（一角色・一 Act）  
> **這是全新遊戲，不是《香江 Card Game》續作。**

## 產品定位

香港霓虹街頭卡牌 Rogue-lite：揀角色、組牌闖三區，一鋪一個傳奇——短、上癮、想再來一局。

- 世界：香港（街頭／城寨／夜市／天台）
- 本切片：阿油・後巷經紀 → Act1「後巷・夜醒」→ Boss 巷口鐵閘・睇場
- 未做：三角色齊裝、Act2/3、完整局外商城

## 如何本地打開

```bash
cd hk-roguelite
python3 -m http.server 8766
```

瀏覽器開啟：<http://127.0.0.1:8766/>

**入口檔**：`hk-roguelite/index.html`

## 目錄結構

```
hk-roguelite/          ← 目錄暫名；產品名《香江小風波》
├── index.html         ← 新專案入口
├── css/main.css
├── js/
│   ├── main.js        ← 畫面流程
│   ├── battle.js      ← 戰鬥
│   └── data.js        ← 角色／牌／敵／地圖（新表）
├── assets/            ← 自舊作複製的圖（enemies／skills／bg／events）
└── README.md
```

## 與舊《香江 Card Game》demo 的隔離

| 規則 | 做法 |
|------|------|
| 新專案路徑 | 本倉庫子目錄 `hk-roguelite/`（產品名《香江小風波》） |
| 新入口 | `hk-roguelite/index.html`（獨立於根目錄 `index.html`） |
| 禁止 | **不修改**倉庫根目錄舊 demo 的主循環／`index.html`／既有遊戲邏輯 |
| 舊作素材 | 僅**複製**進 `hk-roguelite/assets/` 再用於本切片；數值在 `js/data.js` 重表 |
| 禁止搬入 | office_chain／tale_chain、命運年／year_pools／過歲 UI、人生 meta |

## 垂直切片內容

1. **阿油・後巷經紀**：被動「快手」＋廉價攻擊向開局牌組  
2. **Act1 地圖 6 節點**：戰鬥（後巷影／到期罐頭客／逼爆潮）→ 戰後三選一 → 短事件（巷口風聲）→ 休息 → **Boss：巷口鐵閘・睇場**（素材 id 暫留 E04）  
3. 戰鬥可輸可贏；死亡結算＋「再來一局」  
4. 驗收手感：前 10 分鐘內已打架、已選牌、牌組有變  
